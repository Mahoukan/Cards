import { MINIMUM_FAN, WINDS, WIN_SOURCES } from "./constants.js";
import { solveSevenPairs, solveStandardHand, solveThirteenOrphans, validatePlayableTiles } from "./handSolver.js";
import { validateMeld } from "./melds.js";
import { scoreHand } from "./scoring.js";
import { getTileFaceKey } from "./tiles.js";
import { isBonusTile } from "./rules.js";

const failure = (code, message, details = {}) => ({
  structurallyValid: false, qualifiesToWin: false, code, message, bestResult: null, alternatives: [], ...details,
});

const validateBonusTiles = (bonusTiles) => {
  if (!Array.isArray(bonusTiles)) return false;
  const ids = bonusTiles.map(({ id }) => id);
  return ids.every((id) => typeof id === "string") && new Set(ids).size === ids.length
    && bonusTiles.every((tile) => isBonusTile(tile) && getTileFaceKey(tile))
    && new Set(bonusTiles.map(getTileFaceKey)).size === bonusTiles.length;
};

export const evaluateWinningHand = ({
  concealedTiles = [], exposedMelds = [], bonusTiles = [], winningTile,
  winSource, seatWind, prevailingWind, context = {},
} = {}) => {
  if (!WIN_SOURCES.includes(winSource)) return failure("INVALID_WIN_SOURCE", "The win source is invalid.");
  if (!WINDS.includes(seatWind) || !WINDS.includes(prevailingWind)) {
    return failure("INVALID_WIND", "Seat and prevailing winds must be valid.");
  }
  if (!winningTile || !getTileFaceKey(winningTile) || isBonusTile(winningTile)) {
    return failure("MISSING_WINNING_TILE", "A playable winning tile is required.");
  }
  if (!Array.isArray(exposedMelds) || exposedMelds.length > 4 || exposedMelds.some((meld) => !validateMeld(meld))) {
    return failure("INVALID_EXPOSED_MELD", "An exposed meld is invalid.");
  }
  if (!validateBonusTiles(bonusTiles)) return failure("INVALID_BONUS_TILE", "Bonus tiles are invalid or duplicated.");
  const tileValidation = validatePlayableTiles(concealedTiles, exposedMelds.flatMap(({ tiles }) => tiles));
  if (!tileValidation.valid) return failure(tileValidation.code, "The hand contains invalid or impossible tiles.");

  const input = { concealedTiles, exposedMelds };
  const standard = solveStandardHand(input);
  const sevenPairs = solveSevenPairs(input);
  const orphans = solveThirteenOrphans(input);
  const interpretations = [
    ...(standard.valid ? standard.decompositions.map((decomposition) => ({
      handType: "standard", decomposition,
    })) : []),
    ...(sevenPairs.valid ? [{ handType: "seven-pairs", pairs: sevenPairs.pairs }] : []),
    ...(orphans.valid ? [{ handType: "thirteen-orphans", pairedFaceId: orphans.pairedFaceId, tiles: concealedTiles }] : []),
  ].map((result) => ({
    ...result,
    scoring: scoreHand({ result, exposedMelds, bonusTiles, winSource, seatWind, prevailingWind, context }),
  })).sort((a, b) => b.scoring.totalFan - a.scoring.totalFan);

  if (!interpretations.length) {
    const codes = [standard.code, sevenPairs.code, orphans.code];
    const code = codes.includes("INVALID_TILE_COUNT") ? "INVALID_TILE_COUNT"
      : codes.includes("IMPOSSIBLE_TILE_COUNT") ? "IMPOSSIBLE_TILE_COUNT" : "HAND_NOT_COMPLETE";
    return failure(code, "The tiles do not form a complete Mahjong hand.", {
      structuralResults: { standard, sevenPairs, thirteenOrphans: orphans },
    });
  }
  const [bestResult, ...alternatives] = interpretations;
  return {
    structurallyValid: true,
    qualifiesToWin: bestResult.scoring.totalFan >= MINIMUM_FAN,
    code: bestResult.scoring.meetsMinimum ? "MAHJONG_VALID" : "INSUFFICIENT_FAN",
    bestResult,
    alternatives,
  };
};

export const evaluateMahjongDeclaration = (input) => {
  const result = evaluateWinningHand(input);
  return {
    valid: result.qualifiesToWin,
    code: result.qualifiesToWin ? "MAHJONG_VALID" : result.code,
    structuralResult: result,
    scoringResult: result.bestResult?.scoring ?? null,
    suggestedPenalty: result.qualifiesToWin ? null : "round-forfeit",
  };
};
