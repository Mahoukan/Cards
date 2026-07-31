import { MAHJONG_FACE_BY_ID, groupTilesByFace, getTileFaceKey } from "./tiles.js";
import { isChow, isKong, isPung, isBonusTile } from "./rules.js";

const uniqueTiles = (tiles) => Array.isArray(tiles)
  && tiles.every((tile) => tile && typeof tile.id === "string")
  && new Set(tiles.map(({ id }) => id)).size === tiles.length;

export const validateMeld = (meld) => {
  if (!meld || !["chow", "pung", "kong"].includes(meld.type) || !uniqueTiles(meld.tiles)) return false;
  if (meld.tiles.some(isBonusTile)) return false;
  if (meld.type === "chow") return isChow(meld.tiles);
  if (meld.type === "pung") return isPung(meld.tiles);
  return isKong(meld.tiles);
};

export const findChowCandidates = (hand, discardedTile) => {
  if (discardedTile?.category !== "suit" || !Number.isInteger(discardedTile.rank)) return [];
  const groups = groupTilesByFace((hand ?? []).filter((tile) => !isBonusTile(tile)));
  const patterns = [[-2, -1], [-1, 1], [1, 2]];
  return patterns.flatMap(([left, right]) => {
    const ranks = [discardedTile.rank + left, discardedTile.rank + right];
    if (ranks.some((rank) => rank < 1 || rank > 9)) return [];
    const first = groups.get(`${discardedTile.suit}-${ranks[0]}`)?.[0];
    const second = groups.get(`${discardedTile.suit}-${ranks[1]}`)?.[0];
    return first && second ? [[first, second]] : [];
  });
};

const matchingTiles = (hand, tile, count) => {
  const faceId = getTileFaceKey(tile);
  const matches = (hand ?? []).filter((candidate) => getTileFaceKey(candidate) === faceId);
  return faceId && matches.length >= count ? matches.slice(0, count) : null;
};

export const findPungCandidate = (hand, discardedTile) => matchingTiles(hand, discardedTile, 2);
export const findDiscardKongCandidate = (hand, discardedTile) => matchingTiles(hand, discardedTile, 3);

export const findConcealedKongCandidates = (hand) =>
  [...groupTilesByFace(hand ?? []).values()].filter((tiles) => tiles.length === 4 && !tiles[0].isBonus);

export const findAddedKongCandidates = (hand, exposedMelds) => (exposedMelds ?? []).flatMap((meld) => {
  if (meld?.type !== "pung" || !validateMeld(meld)) return [];
  const tile = (hand ?? []).find((candidate) => getTileFaceKey(candidate) === getTileFaceKey(meld.tiles[0]));
  return tile ? [{ tile, pung: meld }] : [];
});

export const createFaceTile = (faceId, copy = 1) => {
  const face = MAHJONG_FACE_BY_ID[faceId];
  return face && !face.isBonus ? { ...face, id: `candidate-${faceId}-${copy}` } : null;
};
