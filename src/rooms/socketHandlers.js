const safeAck = (ack) => typeof ack === "function" ? ack : () => {};

export const registerRoomSocketHandlers = (io, roomManager) => {
  const readyRooms = new Set();
  const broadcast = (room) => {
    if (!room) return;
    io.to(room.code).emit("room:update", room);
    if (room.canStart && !readyRooms.has(room.code)) {
      readyRooms.add(room.code);
      io.to(room.code).emit("room:readyToStart", room);
    } else if (!room.canStart) readyRooms.delete(room.code);
  };

  roomManager.onExpire = ({ room }) => {
    if (room) broadcast(room);
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
      safeAck(ack)(result);
    });

    socket.on("room:setReady", (payload = {}, ack) => {
      const result = roomManager.setReady({ socketId: socket.id, ready: payload.ready });
      if (result.ok) broadcast(result.room);
      safeAck(ack)(result);
    });

    socket.on("room:kick", (payload = {}, ack) => {
      const result = roomManager.kickPlayer({ socketId: socket.id, playerId: payload.playerId });
      if (result.ok) {
        const target = io.sockets.sockets.get(result.removed.socketId);
        target?.emit("room:kicked");
        target?.leave(result.removed.roomCode);
        broadcast(result.room);
      }
      safeAck(ack)(result);
    });

    socket.on("room:leave", (_payload = {}, ack) => {
      const result = roomManager.leaveRoom({ socketId: socket.id });
      if (result.ok) {
        socket.leave(result.removed.roomCode);
        broadcast(result.room);
      }
      safeAck(ack)(result);
    });

    socket.on("disconnect", () => {
      const result = roomManager.disconnect(socket.id);
      if (result) broadcast(result.room);
    });
  });

  return { broadcast };
};
