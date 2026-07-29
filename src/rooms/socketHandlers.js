const safeAck = (ack) => typeof ack === "function" ? ack : () => {};

export const registerRoomSocketHandlers = (io, roomManager, coordinator = null, publishGame = () => {}) => {
  const readyRooms = new Set();
  const broadcast = (room) => {
    if (!room) return;
    io.to(room.code).emit("room:update", room);
    if (room.canStart && !readyRooms.has(room.code)) {
      readyRooms.add(room.code);
      io.to(room.code).emit("room:readyToStart", room);
    } else if (!room.canStart) readyRooms.delete(room.code);
  };

  roomManager.onBeforeRemove = ({ room, player }) => {
    coordinator?.beforePlayerRemoval(room, player);
  };
  roomManager.onExpire = ({ room, code }) => {
    if (room) {
      broadcast(room);
      publishGame(code);
    } else coordinator?.deleteRoom(code);
  };

  io.on("connection", (socket) => {
    socket.on("room:create", (payload = {}, ack) => {
      const result = roomManager.createRoom({ displayName: payload.displayName, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        broadcast(result.room);
      }
      safeAck(ack)(result);
    });

    socket.on("room:join", (payload = {}, ack) => {
      const result = roomManager.joinRoom({ roomCode: payload.roomCode, displayName: payload.displayName, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        broadcast(result.room);
      }
      safeAck(ack)(result);
    });

    socket.on("room:resume", (payload = {}, ack) => {
      const result = roomManager.resumeRoom({ ...payload, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        if (result.replacedSocketId) {
          const oldSocket = io.sockets.sockets.get(result.replacedSocketId);
          oldSocket?.emit("room:sessionReplaced");
          oldSocket?.leave(result.room.code);
        }
        broadcast(result.room);
      }
      safeAck(ack)(result.ok && coordinator
        ? {
            ...result,
            game: coordinator.getView(result.room.code, result.session.playerId),
            exchange: coordinator.getExchangeView(result.room.code, result.session.playerId),
          }
        : result);
    });

    socket.on("room:setReady", (payload = {}, ack) => {
      const result = roomManager.setReady({ socketId: socket.id, ready: payload.ready });
      let response = result;
      if (result.ok) {
        broadcast(result.room);
        const control = roomManager.getControl(socket.id);
        const started = control ? coordinator?.maybeStart(control.code) : null;
        if (started) {
          const latestRoom = roomManager.getPublicRoom(control.code);
          broadcast(latestRoom);
          response = { ...result, room: latestRoom };
        }
      }
      safeAck(ack)(response);
    });

    socket.on("round:setReady", (payload = {}, ack) => {
      const result = coordinator?.setNextRoundReady(socket.id, payload.ready) ?? { ok: false, error: { message: "Round controls are unavailable." } };
      if (result.ok) {
        const control = roomManager.getControl(socket.id);
        if (control) broadcast(roomManager.getPublicRoom(control.code));
      }
      safeAck(ack)(result);
    });

    socket.on("room:kick", (payload = {}, ack) => {
      const result = roomManager.kickPlayer({ socketId: socket.id, playerId: payload.playerId });
      if (result.ok) {
        const target = io.sockets.sockets.get(result.removed.socketId);
        target?.emit("room:kicked");
        target?.leave(result.removed.roomCode);
        broadcast(result.room);
        publishGame(result.removed.roomCode);
      }
      safeAck(ack)(result);
    });

    socket.on("room:leave", (_payload = {}, ack) => {
      const result = roomManager.leaveRoom({ socketId: socket.id });
      if (result.ok) {
        socket.leave(result.removed.roomCode);
        broadcast(result.room);
        if (result.room) publishGame(result.removed.roomCode);
        else coordinator?.deleteRoom(result.removed.roomCode);
      }
      safeAck(ack)(result);
    });

    socket.on("disconnect", () => {
      const result = roomManager.disconnect(socket.id);
      if (result) {
        broadcast(result.room);
        publishGame(result.code);
      }
    });
  });

  return { broadcast };
};
