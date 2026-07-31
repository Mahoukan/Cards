import { socketRequest } from "../../socketSupport.js";
import { silentLogger } from "../../logger.js";

export const registerCrazyEightsSocketHandlers = (
  io, roomManager, coordinator, { limiter = { take: () => true }, logger = silentLogger } = {},
) => {
  const publish = (roomCode, type = "update") => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.gameId !== "crazy-eights") return;
    io.to(roomCode).emit("room:update", roomManager.getPublicRoom(roomCode));
    room.players.filter(({ connected, socketId }) => connected && socketId).forEach((player) => {
      const view = coordinator.getView(roomCode, player.id);
      const socket = io.sockets.sockets.get(player.socketId);
      if (!view || !socket) return;
      socket.emit("crazy-eights:update", view);
      if (type === "started") socket.emit("crazy-eights:round-started", view);
      if (type === "complete") socket.emit("crazy-eights:round-complete", view);
    });
  };
  coordinator.onChange = ({ roomCode, type }) => {
    publish(roomCode, type);
    if (["started", "complete"].includes(type)) logger.info(`crazy_eights_round_${type}`, { roomCode });
  };
  io.on("connection", (socket) => {
    socketRequest({
      socket, event: "crazy-eights:play",
      schema: {
        cardId: { type: "string", min: 1, max: 100 },
        chosenSuit: { type: "string", min: 1, max: 10, optional: true },
      },
      limiter, logger,
      handler: ({ cardId, chosenSuit }) => coordinator.play(socket.id, cardId, chosenSuit),
    });
    socketRequest({ socket, event: "crazy-eights:draw", schema: {}, limiter, logger, handler: () => coordinator.draw(socket.id) });
    socketRequest({ socket, event: "crazy-eights:keep-drawn", schema: {}, limiter, logger, handler: () => coordinator.keepDrawn(socket.id) });
  });
  return { publish };
};
