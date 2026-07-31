import { createMahjongTileSet } from "./tiles.js";
import { evaluateMahjongDeclaration } from "./validation.js";
import { calculatePayments } from "./payments.js";

const tileSet = createMahjongTileSet();
const takeFaces = (faceIds) => {
  const used = new Map();
  return faceIds.map((faceId) => {
    const copy = (used.get(faceId) ?? 0) + 1;
    used.set(faceId, copy);
    const tile = tileSet.find((candidate) => candidate.faceId === faceId && candidate.id.endsWith(`-${copy}`));
    if (!tile) throw new Error(`Demo requested an unavailable ${faceId} tile.`);
    return tile;
  });
};

const chow = (suit, start) => [`${suit}-${start}`, `${suit}-${start + 1}`, `${suit}-${start + 2}`];
const pung = (faceId) => [faceId, faceId, faceId];
const pair = (faceId) => [faceId, faceId];
const baseChows = [
  ...chow("characters", 1), ...chow("characters", 4),
  ...chow("dots", 2), ...chow("bamboo", 6), ...pair("east-wind"),
];
const allPungs = [
  ...pung("characters-2"), ...pung("dots-5"), ...pung("bamboo-8"),
  ...pung("red-dragon"), ...pair("south-wind"),
];
const halfFlush = [
  ...chow("characters", 1), ...chow("characters", 4), ...chow("characters", 7),
  ...pung("red-dragon"), ...pair("east-wind"),
];
const fullFlush = [
  ...chow("bamboo", 1), ...chow("bamboo", 2), ...chow("bamboo", 4),
  ...pung("bamboo-8"), ...pair("bamboo-6"),
];
const sevenPairs = [
  ...pair("characters-1"), ...pair("characters-4"), ...pair("dots-2"), ...pair("dots-8"),
  ...pair("bamboo-3"), ...pair("east-wind"), ...pair("white-dragon"),
];
const orphans = [
  "characters-1", "characters-9", "dots-1", "dots-9", "bamboo-1", "bamboo-9",
  "east-wind", "south-wind", "west-wind", "north-wind",
  "red-dragon", "green-dragon", "white-dragon", "red-dragon",
];
const windHand = [
  ...chow("characters", 1), ...chow("dots", 2), ...chow("bamboo", 3),
  ...pung("east-wind"), ...pair("white-dragon"),
];

const definitions = [
  { id: "basic", name: "Basic valid hand below 3 fan", faces: baseChows, winSource: "discard" },
  { id: "all-pungs", name: "All Pungs", faces: allPungs, winSource: "discard" },
  { id: "half-flush", name: "Half Flush", faces: halfFlush, winSource: "discard" },
  { id: "full-flush", name: "Full Flush", faces: fullFlush, winSource: "discard" },
  { id: "seven-pairs", name: "Seven Pairs", faces: sevenPairs, winSource: "discard" },
  { id: "orphans", name: "Thirteen Orphans", faces: orphans, winSource: "discard" },
  { id: "winds", name: "Matching seat and prevailing wind", faces: windHand, winSource: "discard" },
  {
    id: "bonuses", name: "Flower and season scoring", faces: baseChows, winSource: "discard",
    bonuses: ["spring", "summer", "autumn", "winter", "plum", "orchid", "chrysanthemum", "bamboo-flower"],
  },
  { id: "self-draw", name: "Self-draw", faces: allPungs, winSource: "self-draw" },
  { id: "discard", name: "Discard win", faces: fullFlush, winSource: "discard" },
];

export const createMahjongScoringDemo = () => definitions.map((definition) => {
  const concealedTiles = takeFaces(definition.faces);
  const bonusTiles = takeFaces(definition.bonuses ?? []);
  const input = {
    concealedTiles, exposedMelds: [], bonusTiles,
    winningTile: concealedTiles.at(-1), winSource: definition.winSource,
    seatWind: "east", prevailingWind: "east",
  };
  const declaration = evaluateMahjongDeclaration(input);
  const fan = declaration.scoringResult?.totalFan ?? 0;
  const payment = declaration.valid ? calculatePayments({
    playerIds: ["you", "alex", "morgan", "jamie"],
    winnerPlayerId: "you",
    responsiblePlayerId: definition.winSource === "discard" ? "alex" : undefined,
    winSource: definition.winSource,
    fan,
  }) : null;
  return {
    id: definition.id, name: definition.name, winSource: definition.winSource,
    handType: declaration.structuralResult.bestResult?.handType ?? null,
    structurallyValid: declaration.structuralResult.structurallyValid,
    qualifiesToWin: declaration.valid,
    code: declaration.code,
    scoring: declaration.scoringResult,
    payment,
  };
});
