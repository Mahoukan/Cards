import { socketRequest } from "../socketSupport.js";
import { silentLogger } from "../logger.js";

export const registerGameSocketHandlers = (io, roomManager, coordinator, { limiter = { take: () => true }, logger = silentLogger } = {}) => {
  const publish = (roomCode, type = "update") => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    io.to(roomCode).emit("room:update", roomManager.getPublicRoom(roomCode));
    if (room.status !== "exchange") {
      room.players.filter(({ connected, socketId }) => connected && socketId).forEach((player) => {
        const view = coordinator.getView(roomCode, player.id);
        const socket = io.sockets.sockets.get(player.socketId);
        if (!view || !socket) return;
        socket.emit("game:update", view);
        if (type === "started") socket.emit("game:roundStarted", view);
        if (type === "complete") socket.emit("game:roundComplete", view);
      });
    }
    room.players.filter(({ connected, socketId }) => connected && socketId).forEach((player) => {
      const view = coordinator.getExchangeView(roomCode, player.id);
      const socket = io.sockets.sockets.get(player.socketId);
      if (!view || !socket) return;
      socket.emit("exchange:update", view);
      if (type === "exchange") socket.emit("exchange:started", view);
      if (type === "exchangeCancelled") socket.emit("exchange:cancelled", view);
    });
  };
  coordinator.onChange = ({ roomCode, type }) => {
    publish(roomCode, type);
    const event = {
      started: "round_started",
      complete: "round_completed",
      exchange: "exchange_started",
      exchangeCancelled: "exchange_cancelled",
    }[type];
    if (event) logger.info(event, { roomCode });
  };

  io.on("connection", (socket) => {
    socketRequest({ socket, event: "game:play", schema: { cardIds: { type: "stringArray", max: 4, itemMax: 100 } }, limiter, logger, handler: ({ cardIds }) => coordinator.play(socket.id, cardIds) });
    socketRequest({ socket, event: "game:pass", schema: {}, limiter, logger, handler: () => coordinator.pass(socket.id) });
    socketRequest({ socket, event: "exchange:returnCards", schema: { cardIds: { type: "stringArray", max: 2, itemMax: 100 } }, limiter, logger, handler: ({ cardIds }) => coordinator.returnExchangeCards(socket.id, cardIds) });
  });
  return { publish };
};
