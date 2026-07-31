import { DRAGONS, FLOWERS, SEASONS, SUITS, WINDS } from "./constants.js";

const assetPath = (faceId) => `/assets/mahjong/${faceId}.svg`;
const freezeFace = (face) => Object.freeze({ ...face, assetPath: assetPath(face.faceId) });

export const MAHJONG_TILE_FACES = Object.freeze([
  ...SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => freezeFace({
    faceId: `${suit}-${index + 1}`, category: "suit", suit, rank: index + 1,
    isHonor: false, isBonus: false,
  }))),
  ...WINDS.map((wind) => freezeFace({
    faceId: `${wind}-wind`, category: "honor", honorType: "wind", wind,
    isHonor: true, isBonus: false,
  })),
  ...DRAGONS.map((dragon) => freezeFace({
    faceId: `${dragon}-dragon`, category: "honor", honorType: "dragon", dragon,
    isHonor: true, isBonus: false,
  })),
  ...SEASONS.map((season, index) => freezeFace({
    faceId: season, category: "bonus", bonusType: "season", seatNumber: index + 1,
    isHonor: false, isBonus: true,
  })),
  ...FLOWERS.map((flower, index) => freezeFace({
    faceId: flower, category: "bonus", bonusType: "flower", seatNumber: index + 1,
    isHonor: false, isBonus: true,
  })),
]);

export const MAHJONG_FACE_BY_ID = Object.freeze(Object.fromEntries(
  MAHJONG_TILE_FACES.map((face) => [face.faceId, face]),
));

export const createMahjongTileSet = () => MAHJONG_TILE_FACES.flatMap((face) => {
  const copies = face.isBonus ? 1 : 4;
  return Array.from({ length: copies }, (_, index) => ({ ...face, id: `${face.faceId}-${index + 1}` }));
});

const categoryOrder = { suit: 0, honor: 1, bonus: 2 };
const suitOrder = Object.fromEntries(SUITS.map((suit, index) => [suit, index]));
const honorOrder = Object.fromEntries([
  ...WINDS.map((wind, index) => [`${wind}-wind`, index]),
  ...DRAGONS.map((dragon, index) => [`${dragon}-dragon`, WINDS.length + index]),
]);
const bonusOrder = Object.fromEntries([
  ...SEASONS.map((faceId, index) => [faceId, index]),
  ...FLOWERS.map((faceId, index) => [faceId, SEASONS.length + index]),
]);

export const compareMahjongTiles = (a, b) => {
  const categoryDifference = categoryOrder[a.category] - categoryOrder[b.category];
  if (categoryDifference) return categoryDifference;
  if (a.category === "suit") return suitOrder[a.suit] - suitOrder[b.suit] || a.rank - b.rank;
  if (a.category === "honor") return honorOrder[a.faceId] - honorOrder[b.faceId];
  return bonusOrder[a.faceId] - bonusOrder[b.faceId];
};

export const sortMahjongTiles = (tiles) => [...tiles].sort(compareMahjongTiles);
