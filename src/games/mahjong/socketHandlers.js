import { socketRequest } from "../../socketSupport.js";
import { silentLogger } from "../../logger.js";

export const registerMahjongSocketHandlers = (
  io, roomManager, coordinator, { limiter = { take: () => true }, logger = silentLogger } = {},
) => {
  const publish = (roomCode, type = "update") => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.gameId !== "mahjong") return;
    io.to(roomCode).emit("room:update", roomManager.getPublicRoom(roomCode));
    room.players.filter(({ connected, socketId }) => connected && socketId).forEach((player) => {
      const view = coordinator.getView(roomCode, player.id);
      const socket = io.sockets.sockets.get(player.socketId);
      if (!view || !socket) return;
      socket.emit("mahjong:update", view);
      if (type === "started") socket.emit("mahjong:round-started", view);
      if (type === "complete") socket.emit("mahjong:round-complete", view);
    });
  };
  coordinator.onChange = ({ roomCode, type }) => {
    publish(roomCode, type);
    if (type !== "update") logger.info(`mahjong_${type}`, { roomCode, gameId: "mahjong" });
  };
  io.on("connection", (socket) => {
    socketRequest({ socket, event: "mahjong:discard", schema: { tileId: { type: "string", min: 1, max: 100 } }, limiter, logger, handler: ({ tileId }) => coordinator.discard(socket.id, tileId) });
    socketRequest({ socket, event: "mahjong:claim", schema: {
      type: { type: "string", min: 1, max: 20 },
      tileIds: { type: "stringArray", max: 4, itemMax: 100, optional: true },
    }, limiter, logger, handler: (payload) => coordinator.claim(socket.id, payload) });
    socketRequest({ socket, event: "mahjong:declare-win", schema: {}, limiter, logger, handler: () => coordinator.declareWin(socket.id) });
    socketRequest({ socket, event: "mahjong:declare-kong", schema: {
      type: { type: "string", min: 1, max: 20 },
      tileIds: { type: "stringArray", max: 4, itemMax: 100, optional: true },
      tileId: { type: "string", min: 1, max: 100, optional: true },
      meldId: { type: "string", min: 1, max: 100, optional: true },
    }, limiter, logger, handler: (payload) => coordinator.declareKong(socket.id, payload) });
  });
  return { publish };
};
