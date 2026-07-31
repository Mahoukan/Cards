export const SUITS = Object.freeze(["characters", "dots", "bamboo"]);
export const WINDS = Object.freeze(["east", "south", "west", "north"]);
export const DRAGONS = Object.freeze(["red", "green", "white"]);
export const SEASONS = Object.freeze(["spring", "summer", "autumn", "winter"]);
export const FLOWERS = Object.freeze(["plum", "orchid", "chrysanthemum", "bamboo-flower"]);
export const DEAD_WALL_SIZE = 14;
export const MINIMUM_PLAYERS = 2;
export const MAXIMUM_PLAYERS = 4;
export const MINIMUM_FAN = 3;
export const WIN_SOURCES = Object.freeze([
  "self-draw", "discard", "kong-replacement", "robbed-kong", "last-live-tile",
]);
export const ORPHAN_FACE_IDS = Object.freeze([
  "characters-1", "characters-9", "dots-1", "dots-9", "bamboo-1", "bamboo-9",
  "east-wind", "south-wind", "west-wind", "north-wind",
  "red-dragon", "green-dragon", "white-dragon",
]);

export const FAN_VALUES = Object.freeze({
  SEVEN_PAIRS: 4,
  THIRTEEN_ORPHANS: 13,
  ALL_PUNGS: 3,
  HALF_FLUSH: 3,
  FULL_FLUSH: 7,
  FULLY_CONCEALED: 1,
  SELF_DRAW: 1,
  KONG_REPLACEMENT: 1,
  ROBBED_KONG: 1,
  LAST_LIVE_TILE: 1,
  DRAGON_SET: 1,
  SEAT_WIND: 1,
  PREVAILING_WIND: 1,
  MATCHING_FLOWER: 1,
  MATCHING_SEASON: 1,
  COMPLETE_FLOWERS: 2,
  COMPLETE_SEASONS: 2,
  ALL_BONUS_TILES: 4,
});

export const SEAT_ASSIGNMENTS = Object.freeze({
  1: Object.freeze({ wind: "east", season: "spring", flower: "plum" }),
  2: Object.freeze({ wind: "south", season: "summer", flower: "orchid" }),
  3: Object.freeze({ wind: "west", season: "autumn", flower: "chrysanthemum" }),
  4: Object.freeze({ wind: "north", season: "winter", flower: "bamboo-flower" }),
});

const getSeatAssignment = (seatNumber) => SEAT_ASSIGNMENTS[seatNumber] ?? null;
export const getSeatWind = (seatNumber) => getSeatAssignment(seatNumber)?.wind ?? null;
export const getMatchingSeason = (seatNumber) => getSeatAssignment(seatNumber)?.season ?? null;
export const getMatchingFlower = (seatNumber) => getSeatAssignment(seatNumber)?.flower ?? null;
