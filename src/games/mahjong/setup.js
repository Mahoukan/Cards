import { MAXIMUM_PLAYERS, MINIMUM_PLAYERS, getSeatWind } from "./constants.js";
import { isBonusTile } from "./rules.js";
import { sortMahjongTiles } from "./tiles.js";
import { createWall, drawFromLiveWall, drawReplacementTile } from "./wall.js";

export const createMahjongRound = ({
  players, dealerPlayerId, prevailingWind = "east", tiles, random,
} = {}) => {
  if (!Array.isArray(players) || players.length < MINIMUM_PLAYERS || players.length > MAXIMUM_PLAYERS) {
    throw new RangeError("Mahjong requires 2 to 4 players.");
  }
  if (!players.some(({ id }) => id === dealerPlayerId)) throw new Error("Dealer must be an active player.");
  let wall = createWall({ tiles, random, shuffle: tiles === undefined });
  const roundPlayers = players.map((player, index) => ({
    id: player.id, name: player.name, seatNumber: index + 1, seatWind: getSeatWind(index + 1),
    concealedTiles: [], exposedMelds: [], bonusTiles: [], discards: [],
  }));

  const acceptPlayableTile = (player, tile, replacement) => {
    let nextTile = tile;
    let attempts = 0;
    while (nextTile?.isBonus && attempts < 144) {
      player.bonusTiles.push(nextTile);
      const result = drawReplacementTile(wall);
      wall = result.wall;
      nextTile = result.tile;
      attempts += 1;
    }
    if (!nextTile) throw new Error("The wall was exhausted during the initial deal.");
    if (isBonusTile(nextTile)) throw new Error("Unable to replace bonus tiles during the initial deal.");
    player.concealedTiles.push(nextTile);
    return replacement;
  };

  const targets = roundPlayers.map(({ id }) => id === dealerPlayerId ? 14 : 13);
  while (roundPlayers.some((player, index) => player.concealedTiles.length < targets[index])) {
    roundPlayers.forEach((player, index) => {
      if (player.concealedTiles.length >= targets[index]) return;
      const result = drawFromLiveWall(wall);
      wall = result.wall;
      if (!result.tile) throw new Error("The live wall was exhausted during the initial deal.");
      acceptPlayableTile(player, result.tile, false);
    });
  }
  roundPlayers.forEach((player) => { player.concealedTiles = sortMahjongTiles(player.concealedTiles); });
  return {
    gameId: "mahjong", phase: "dealer-discard", players: roundPlayers,
    dealerPlayerId, originalEastPlayerId: dealerPlayerId, prevailingWind,
    liveWall: wall.liveWall, deadWall: wall.deadWall,
    currentPlayerId: dealerPlayerId, lastDrawnTileId: null, discardSequence: 0,
  };
};
