import {
  FAN_VALUES, FLOWERS, MINIMUM_FAN, SEASONS, WINDS,
  getMatchingFlower, getMatchingSeason,
} from "./constants.js";
import { getTileFaceKey } from "./tiles.js";

const item = (code, name, fan) => ({ code, name, fan });
const setMelds = (result) => result.handType === "standard" ? result.decomposition.melds : [];
const playableTiles = (result) => {
  if (result.handType === "standard") {
    return [...result.decomposition.pair, ...result.decomposition.melds.flatMap(({ tiles }) => tiles)];
  }
  if (result.handType === "seven-pairs") return result.pairs.flat();
  return result.tiles;
};

const addFlush = (items, result) => {
  if (result.handType === "thirteen-orphans") return;
  const tiles = playableTiles(result);
  const suits = new Set(tiles.filter(({ category }) => category === "suit").map(({ suit }) => suit));
  const hasHonors = tiles.some(({ category }) => category === "honor");
  if (suits.size !== 1) return;
  if (hasHonors) items.push(item("HALF_FLUSH", "Half Flush", FAN_VALUES.HALF_FLUSH));
  else items.push(item("FULL_FLUSH", "Full Flush", FAN_VALUES.FULL_FLUSH));
};

const addSetFan = (items, result, seatWind, prevailingWind) => {
  if (result.handType !== "standard") return;
  const melds = setMelds(result);
  if (melds.every(({ type }) => type === "pung" || type === "kong")) {
    items.push(item("ALL_PUNGS", "All Pungs", FAN_VALUES.ALL_PUNGS));
  }
  for (const meld of melds.filter(({ type }) => type === "pung" || type === "kong")) {
    const faceId = getTileFaceKey(meld.tiles[0]);
    if (faceId?.endsWith("-dragon")) {
      const name = faceId.replace("-dragon", "");
      items.push(item(`${name.toUpperCase()}_DRAGON`, `${name[0].toUpperCase()}${name.slice(1)} Dragon`, FAN_VALUES.DRAGON_SET));
    }
    if (faceId === `${seatWind}-wind`) items.push(item("SEAT_WIND", "Seat Wind", FAN_VALUES.SEAT_WIND));
    if (faceId === `${prevailingWind}-wind`) items.push(item("PREVAILING_WIND", "Prevailing Wind", FAN_VALUES.PREVAILING_WIND));
  }
};

const addBonusFan = (items, bonusTiles, seatWind) => {
  const ids = new Set((bonusTiles ?? []).map(getTileFaceKey));
  const seatNumber = WINDS.indexOf(seatWind) + 1;
  const matchingFlower = getMatchingFlower(seatNumber);
  const matchingSeason = getMatchingSeason(seatNumber);
  if (ids.has(matchingFlower)) items.push(item("MATCHING_FLOWER", "Matching Seat Flower", FAN_VALUES.MATCHING_FLOWER));
  if (ids.has(matchingSeason)) items.push(item("MATCHING_SEASON", "Matching Seat Season", FAN_VALUES.MATCHING_SEASON));
  if (FLOWERS.every((faceId) => ids.has(faceId))) {
    items.push(item("COMPLETE_FLOWERS", "Complete Flower Set", FAN_VALUES.COMPLETE_FLOWERS));
  }
  if (SEASONS.every((faceId) => ids.has(faceId))) {
    items.push(item("COMPLETE_SEASONS", "Complete Season Set", FAN_VALUES.COMPLETE_SEASONS));
  }
  if ([...FLOWERS, ...SEASONS].every((faceId) => ids.has(faceId))) {
    items.push(item("ALL_BONUS_TILES", "All Eight Flowers and Seasons", FAN_VALUES.ALL_BONUS_TILES));
  }
};

export const scoreHand = ({
  result, exposedMelds = [], bonusTiles = [], winSource, seatWind, prevailingWind,
} = {}) => {
  const items = [];
  if (result.handType === "seven-pairs") items.push(item("SEVEN_PAIRS", "Seven Pairs", FAN_VALUES.SEVEN_PAIRS));
  if (result.handType === "thirteen-orphans") {
    items.push(item("THIRTEEN_ORPHANS", "Thirteen Orphans", FAN_VALUES.THIRTEEN_ORPHANS));
  }
  if (exposedMelds.every((meld) => meld.exposed === false || meld.concealed === true)) {
    items.push(item("FULLY_CONCEALED", "Fully Concealed Hand", FAN_VALUES.FULLY_CONCEALED));
  }
  if (winSource === "self-draw") items.push(item("SELF_DRAW", "Self-draw", FAN_VALUES.SELF_DRAW));
  if (winSource === "kong-replacement") {
    items.push(item("KONG_REPLACEMENT", "Kong Replacement Win", FAN_VALUES.KONG_REPLACEMENT));
  }
  if (winSource === "robbed-kong") items.push(item("ROBBED_KONG", "Robbing an Added Kong", FAN_VALUES.ROBBED_KONG));
  if (winSource === "last-live-tile") {
    items.push(item("LAST_LIVE_TILE", "Final Live-wall Tile", FAN_VALUES.LAST_LIVE_TILE));
  }
  addFlush(items, result);
  addSetFan(items, result, seatWind, prevailingWind);
  addBonusFan(items, bonusTiles, seatWind);
  const totalFan = items.reduce((total, scoringItem) => total + scoringItem.fan, 0);
  return { totalFan, minimumFan: MINIMUM_FAN, meetsMinimum: totalFan >= MINIMUM_FAN, items };
};
