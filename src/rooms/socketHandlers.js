import { socketRequest } from "../socketSupport.js";
import { silentLogger } from "../logger.js";

export const registerRoomSocketHandlers = (io, roomManager, coordinator = null, publishGame = () => {}, {
  limiter = { take: () => true, clear() {} }, logger = silentLogger,
} = {}) => {
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
    const wasPlaying = room.status === "playing";
    coordinator?.beforePlayerRemoval(room, player);
    if (wasPlaying) logger.info("player_forfeited", { roomCode: room.code, playerId: player.id });
  };
  roomManager.onExpire = ({ room, code }) => {
    if (room) {
      broadcast(room);
      publishGame(code);
    } else {
      coordinator?.deleteRoom(code);
      logger.info("room_deleted", { roomCode: code, reason: "expired" });
    }
  };

  io.on("connection", (socket) => {
    socketRequest({ socket, event: "room:create", schema: {
      displayName: { type: "string", min: 1, max: 20 },
      gameId: { type: "string", min: 1, max: 30, optional: true },
    }, limiter, logger, handler: (payload) => {
      const result = roomManager.createRoom({ displayName: payload.displayName, gameId: payload.gameId, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        broadcast(result.room);
        logger.info("room_created", { roomCode: result.room.code, playerId: result.session.playerId });
      }
      return result;
    } });

    socketRequest({ socket, event: "room:join", schema: { roomCode: { type: "string", min: 1, max: 12 }, displayName: { type: "string", min: 1, max: 20 } }, limiter, logger, handler: (payload) => {
      const result = roomManager.joinRoom({ roomCode: payload.roomCode, displayName: payload.displayName, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        broadcast(result.room);
        logger.info("player_joined", { roomCode: result.room.code, playerId: result.session.playerId });
      }
      return result;
    } });

    socketRequest({ socket, event: "room:resume", schema: {
      roomCode: { type: "string", min: 1, max: 12 },
      playerId: { type: "string", min: 1, max: 100 },
      reconnectToken: { type: "string", min: 1, max: 200 },
    }, limiter, logger, handler: (payload) => {
      const result = roomManager.resumeRoom({ roomCode: payload.roomCode, playerId: payload.playerId, reconnectToken: payload.reconnectToken, socketId: socket.id });
      if (result.ok) {
        socket.join(result.room.code);
        if (result.replacedSocketId) {
          const oldSocket = io.sockets.sockets.get(result.replacedSocketId);
          oldSocket?.emit("room:sessionReplaced");
          oldSocket?.leave(result.room.code);
          logger.info("session_replaced", { roomCode: result.room.code, playerId: result.session.playerId });
        }
        broadcast(result.room);
        logger.info("session_resumed", { roomCode: result.room.code, playerId: result.session.playerId });
      }
      return result.ok && coordinator
        ? {
            ...result,
            game: coordinator.getView(result.room.code, result.session.playerId),
            crazyEights: coordinator.getCrazyEightsView?.(result.room.code, result.session.playerId) ?? null,
            mahjong: coordinator.getMahjongView?.(result.room.code, result.session.playerId) ?? null,
            exchange: coordinator.getExchangeView(result.room.code, result.session.playerId),
          }
        : result;
    } });

    socketRequest({ socket, event: "room:setReady", schema: { ready: { type: "boolean" } }, limiter, logger, handler: (payload) => {
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
      return response;
    } });

    socketRequest({ socket, event: "round:setReady", schema: { ready: { type: "boolean" } }, limiter, logger, handler: (payload) => {
      const result = coordinator?.setNextRoundReady(socket.id, payload.ready) ?? { ok: false, error: { message: "Round controls are unavailable." } };
      if (result.ok) {
        const control = roomManager.getControl(socket.id);
        if (control) broadcast(roomManager.getPublicRoom(control.code));
      }
      return result;
    } });

    socketRequest({ socket, event: "room:kick", schema: { playerId: { type: "string", min: 1, max: 100 } }, limiter, logger, handler: (payload) => {
      const result = roomManager.kickPlayer({ socketId: socket.id, playerId: payload.playerId });
      if (result.ok) {
        const target = io.sockets.sockets.get(result.removed.socketId);
        target?.emit("room:kicked");
        target?.leave(result.removed.roomCode);
        broadcast(result.room);
        publishGame(result.removed.roomCode);
        logger.info("player_left", { roomCode: result.removed.roomCode, playerId: result.removed.playerId, reason: "kick" });
      }
      return result;
    } });

    socketRequest({ socket, event: "room:leave", schema: {}, limiter, logger, handler: () => {
      const result = roomManager.leaveRoom({ socketId: socket.id });
      if (result.ok) {
        socket.leave(result.removed.roomCode);
        broadcast(result.room);
        if (result.room) publishGame(result.removed.roomCode);
        else {
          coordinator?.deleteRoom(result.removed.roomCode);
          logger.info("room_deleted", { roomCode: result.removed.roomCode, reason: "empty" });
        }
        logger.info("player_left", { roomCode: result.removed.roomCode, playerId: result.removed.playerId, reason: "leave" });
      }
      return result;
    } });

    socket.on("disconnect", (reason) => {
      limiter.clear(socket.id);
      logger.info("socket_disconnected", { socketId: socket.id, reason });
      const result = roomManager.disconnect(socket.id);
      if (result) {
        broadcast(result.room);
        publishGame(result.code);
      }
    });
  });

  return { broadcast };
};
