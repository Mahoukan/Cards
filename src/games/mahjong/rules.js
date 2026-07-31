import { getMatchingFlower, getMatchingSeason, getSeatWind } from "./constants.js";

const faceId = (tile) => tile?.faceId ?? null;
export const isSuitedTile = (tile) => tile?.category === "suit";
export const isHonorTile = (tile) => tile?.category === "honor";
export const isBonusTile = (tile) => tile?.category === "bonus" || tile?.isBonus === true;
export const isFlowerOrSeason = isBonusTile;
export const mayAppearInChow = isSuitedTile;
export const countEquivalentFaces = (tiles, target) =>
  tiles.filter((tile) => faceId(tile) === faceId(target)).length;
export const isPung = (tiles) =>
  tiles.length === 3 && tiles.every((tile) => faceId(tile) === faceId(tiles[0]));
export const isKong = (tiles) =>
  tiles.length === 4 && tiles.every((tile) => faceId(tile) === faceId(tiles[0]));
export const isChow = (tiles) => {
  if (tiles.length !== 3 || !tiles.every(isSuitedTile)) return false;
  if (!tiles.every((tile) => tile.suit === tiles[0].suit)) return false;
  const ranks = tiles.map(({ rank }) => rank).sort((a, b) => a - b);
  return new Set(ranks).size === 3 && ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1;
};

export { getMatchingFlower, getMatchingSeason, getSeatWind };
