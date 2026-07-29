const safeAck = (ack) => typeof ack === "function" ? ack : () => {};

export const registerGameSocketHandlers = (io, roomManager, coordinator) => {
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
  coordinator.onChange = ({ roomCode, type }) => publish(roomCode, type);

  io.on("connection", (socket) => {
    socket.on("game:play", (payload = {}, ack) => {
      const result = coordinator.play(socket.id, payload.cardIds);
      safeAck(ack)(result);
    });
    socket.on("game:pass", (_payload = {}, ack) => {
      const result = coordinator.pass(socket.id);
      safeAck(ack)(result);
    });
    socket.on("exchange:returnCards", (payload = {}, ack) => {
      const result = coordinator.returnExchangeCards(socket.id, payload.cardIds);
      safeAck(ack)(result);
    });
  });
  return { publish };
};
