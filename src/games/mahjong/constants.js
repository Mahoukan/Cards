export const SUITS = Object.freeze(["characters", "dots", "bamboo"]);
export const WINDS = Object.freeze(["east", "south", "west", "north"]);
export const DRAGONS = Object.freeze(["red", "green", "white"]);
export const SEASONS = Object.freeze(["spring", "summer", "autumn", "winter"]);
export const FLOWERS = Object.freeze(["plum", "orchid", "chrysanthemum", "bamboo-flower"]);
export const DEAD_WALL_SIZE = 14;
export const MINIMUM_PLAYERS = 2;
export const MAXIMUM_PLAYERS = 4;

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
