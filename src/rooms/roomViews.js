import { MAXIMUM_PLAYERS, MINIMUM_PLAYERS, ROOM_STATUS } from "./constants.js";
import { getGameById } from "../../public/js/games/gameCatalog.js";

export const canRoomStart = (room) =>
  room.status === ROOM_STATUS.LOBBY &&
  room.players.length >= MINIMUM_PLAYERS &&
  room.players.every((player) => player.connected && player.ready);

export const canPrepareNextRound = (room) =>
  room.status === ROOM_STATUS.ROUND_COMPLETE &&
  room.players.length >= MINIMUM_PLAYERS &&
  room.players.every((player) => player.connected && player.nextRoundReady);

export const createPublicRoomView = (room) => ({
  code: room.code,
  gameId: room.gameId ?? "president",
  gameName: getGameById(room.gameId ?? "president")?.name ?? "President",
  gameDescription: getGameById(room.gameId ?? "president")?.description ?? "",
  status: room.status,
  hostPlayerId: room.hostPlayerId,
  playerCount: room.players.length,
  minimumPlayers: getGameById(room.gameId ?? "president")?.minimumPlayers ?? MINIMUM_PLAYERS,
  maximumPlayers: getGameById(room.gameId ?? "president")?.maximumPlayers ?? MAXIMUM_PLAYERS,
  canStart: canRoomStart(room),
  nextRoundCanStart: canPrepareNextRound(room),
  players: room.players.map((player) => ({
    id: player.id,
    name: player.name,
    connected: player.connected,
    ready: player.ready,
    nextRoundReady: player.nextRoundReady ?? false,
    isHost: player.id === room.hostPlayerId,
  })),
});
