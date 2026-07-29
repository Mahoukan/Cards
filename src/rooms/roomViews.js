import { MAXIMUM_PLAYERS, MINIMUM_PLAYERS } from "./constants.js";

export const canRoomStart = (room) =>
  room.status === "lobby" &&
  room.players.length >= MINIMUM_PLAYERS &&
  room.players.every((player) => player.connected && player.ready);

export const createPublicRoomView = (room) => ({
  code: room.code,
  status: room.status,
  hostPlayerId: room.hostPlayerId,
  playerCount: room.players.length,
  minimumPlayers: MINIMUM_PLAYERS,
  maximumPlayers: MAXIMUM_PLAYERS,
  canStart: canRoomStart(room),
  players: room.players.map((player) => ({
    id: player.id,
    name: player.name,
    connected: player.connected,
    ready: player.ready,
    isHost: player.id === room.hostPlayerId,
  })),
});
