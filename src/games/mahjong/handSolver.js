import { MAHJONG_FACE_BY_ID, countTilesByFace, getTileFaceKey, groupTilesByFace } from "./tiles.js";
import { ORPHAN_FACE_IDS } from "./constants.js";
import { createFaceTile, validateMeld } from "./melds.js";
import { isBonusTile } from "./rules.js";

const invalid = (code, message) => ({ valid: false, code, message, decompositions: [] });

export const validatePlayableTiles = (tiles, extraTiles = []) => {
  if (!Array.isArray(tiles)) return { valid: false, code: "INVALID_TILE_COUNT" };
  const all = [...tiles, ...extraTiles];
  if (all.some((tile) => !tile || typeof tile.id !== "string" || !getTileFaceKey(tile))) {
    return { valid: false, code: "INVALID_TILE" };
  }
  if (all.some(isBonusTile)) return { valid: false, code: "BONUS_TILE_IN_HAND" };
  if (new Set(all.map(({ id }) => id)).size !== all.length) return { valid: false, code: "DUPLICATE_TILE_ID" };
  if ([...countTilesByFace(all).values()].some((count) => count > 4)) {
    return { valid: false, code: "IMPOSSIBLE_TILE_COUNT" };
  }
  return { valid: true };
};

const decompositionKey = ({ pair, melds }) => [
  getTileFaceKey(pair[0]),
  ...melds.map((meld) => `${meld.type}:${meld.tiles.map(getTileFaceKey).sort().join(",")}`).sort(),
].join("|");

const solveMelds = (groups, required, melds = []) => {
  if (required === 0) return [...groups.values()].every((tiles) => tiles.length === 0) ? [melds] : [];
  const entry = [...groups.entries()].find(([, tiles]) => tiles.length);
  if (!entry) return [];
  const [faceId, tiles] = entry;
  const face = MAHJONG_FACE_BY_ID[faceId];
  const options = [];
  const take = (spec, type) => {
    const next = new Map([...groups].map(([key, value]) => [key, [...value]]));
    const selected = [];
    for (const [key, amount] of spec) {
      const source = next.get(key) ?? [];
      if (source.length < amount) return;
      selected.push(...source.splice(0, amount));
      next.set(key, source);
    }
    options.push(...solveMelds(next, required - 1, [...melds, { type, tiles: selected, exposed: false }]));
  };
  if (tiles.length >= 3) take([[faceId, 3]], "pung");
  if (tiles.length >= 4) take([[faceId, 4]], "kong");
  if (face?.category === "suit" && face.rank <= 7) {
    take([
      [faceId, 1], [`${face.suit}-${face.rank + 1}`, 1], [`${face.suit}-${face.rank + 2}`, 1],
    ], "chow");
  }
  return options;
};

export const solveStandardHand = ({ concealedTiles = [], exposedMelds = [] } = {}) => {
  if (!Array.isArray(exposedMelds) || exposedMelds.length > 4 || exposedMelds.some((meld) => !validateMeld(meld))) {
    return invalid("INVALID_EXPOSED_MELD", "Exposed melds must be valid Chows, Pungs, or Kongs.");
  }
  const exposedTiles = exposedMelds.flatMap(({ tiles }) => tiles);
  const tileValidation = validatePlayableTiles(concealedTiles, exposedTiles);
  if (!tileValidation.valid) return invalid(tileValidation.code, "The hand contains invalid or impossible tiles.");
  const requiredMelds = 4 - exposedMelds.length;
  const minimumCount = 2 + (requiredMelds * 3);
  const maximumCount = minimumCount + requiredMelds;
  if (concealedTiles.length < minimumCount || concealedTiles.length > maximumCount) {
    return invalid("INVALID_TILE_COUNT", "The concealed tile count does not match the declared melds.");
  }
  const groups = groupTilesByFace(concealedTiles);
  const results = [];
  for (const [pairFace, pairTiles] of groups) {
    if (pairTiles.length < 2) continue;
    const remaining = new Map([...groups].map(([key, value]) => [key, [...value]]));
    const pair = remaining.get(pairFace).splice(0, 2);
    results.push(...solveMelds(remaining, requiredMelds).map((melds) => ({
      pair,
      melds: [...exposedMelds.map((meld) => ({ ...meld, exposed: meld.exposed !== false })), ...melds],
    })));
  }
  const unique = [...new Map(results.map((result) => [decompositionKey(result), result])).values()];
  return unique.length ? { valid: true, code: "VALID", decompositions: unique } : invalid("HAND_NOT_COMPLETE", "Tiles cannot form four melds and a pair.");
};

export const solveSevenPairs = ({ concealedTiles = [], exposedMelds = [] } = {}) => {
  if (exposedMelds.length) return { valid: false, code: "INVALID_EXPOSED_MELD", pairs: [] };
  const validation = validatePlayableTiles(concealedTiles);
  if (!validation.valid) return { valid: false, code: validation.code, pairs: [] };
  if (concealedTiles.length !== 14) return { valid: false, code: "INVALID_TILE_COUNT", pairs: [] };
  const pairs = [];
  for (const tiles of groupTilesByFace(concealedTiles).values()) {
    if (tiles.length !== 2 && tiles.length !== 4) return { valid: false, code: "HAND_NOT_COMPLETE", pairs: [] };
    for (let index = 0; index < tiles.length; index += 2) pairs.push(tiles.slice(index, index + 2));
  }
  return pairs.length === 7 ? { valid: true, code: "VALID", pairs } : { valid: false, code: "HAND_NOT_COMPLETE", pairs: [] };
};

export const solveThirteenOrphans = ({ concealedTiles = [], exposedMelds = [] } = {}) => {
  if (exposedMelds.length) return { valid: false, code: "INVALID_EXPOSED_MELD", pairedFaceId: null };
  const validation = validatePlayableTiles(concealedTiles);
  if (!validation.valid) return { valid: false, code: validation.code, pairedFaceId: null };
  if (concealedTiles.length !== 14) return { valid: false, code: "INVALID_TILE_COUNT", pairedFaceId: null };
  const counts = countTilesByFace(concealedTiles);
  const keys = [...counts.keys()];
  const pairedFaceId = ORPHAN_FACE_IDS.find((faceId) => counts.get(faceId) === 2);
  const valid = keys.length === 13 && keys.every((key) => ORPHAN_FACE_IDS.includes(key))
    && ORPHAN_FACE_IDS.every((key) => counts.get(key) >= 1) && Boolean(pairedFaceId);
  return valid ? { valid: true, code: "VALID", pairedFaceId } : { valid: false, code: "HAND_NOT_COMPLETE", pairedFaceId: null };
};

export const findWinningTileFaces = ({ concealedTiles = [], exposedMelds = [] } = {}) => {
  const validation = validatePlayableTiles(concealedTiles, exposedMelds.flatMap(({ tiles = [] }) => tiles));
  if (!validation.valid) return [];
  const counts = countTilesByFace([...concealedTiles, ...exposedMelds.flatMap(({ tiles }) => tiles)]);
  return Object.values(MAHJONG_FACE_BY_ID).filter((face) => !face.isBonus && (counts.get(face.faceId) ?? 0) < 4)
    .filter((face) => {
      const tile = createFaceTile(face.faceId, (counts.get(face.faceId) ?? 0) + 1);
      const input = { concealedTiles: [...concealedTiles, tile], exposedMelds };
      return solveStandardHand(input).valid || solveSevenPairs(input).valid || solveThirteenOrphans(input).valid;
    }).map(({ faceId }) => faceId);
};
