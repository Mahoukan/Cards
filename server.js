import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { createConfig } from "./src/config.js";
import { createLogger } from "./src/logger.js";
import { SocketActionLimiter } from "./src/socketSupport.js";
import { RoomManager, registerRoomSocketHandlers } from "./src/rooms/index.js";
import { GameCoordinator, registerGameSocketHandlers } from "./src/game/index.js";
import { CrazyEightsCoordinator, registerCrazyEightsSocketHandlers } from "./src/games/crazyEights/index.js";
import { createMahjongScoringDemo } from "./src/games/mahjong/demoScenarios.js";
import { MahjongCoordinator, registerMahjongSocketHandlers } from "./src/games/mahjong/index.js";

export const createApplication = ({
  config = createConfig(),
  logger = createLogger({ level: config.logLevel }),
  now = Date.now,
  installSignalHandlers = false,
} = {}) => {
  const app = express();
  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, config.publicOrigin ? {
    cors: { origin: config.publicOrigin, credentials: true },
  } : {});
  const limiter = new SocketActionLimiter({
    limit: config.socketActionLimit,
    windowMs: config.socketActionWindowMs,
    now,
  });
  const roomManager = new RoomManager({ graceMs: config.roomReconnectGraceMs });
  const gameCoordinator = new GameCoordinator({ roomManager, turnDurationMs: config.turnDurationMs, logger });
  const crazyEightsCoordinator = new CrazyEightsCoordinator({ roomManager, turnDurationMs: config.turnDurationMs });
  const mahjongCoordinator = new MahjongCoordinator({ roomManager, turnDurationMs: config.turnDurationMs, logger });
  let ready = false;
  let shutdownPromise = null;
  let forceTimer = null;

  app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "public")));
  app.get("/demo/mahjong-scoring", (_request, response) => {
    if (config.nodeEnv === "production") return response.status(404).json({ error: "Not found" });
    return response.json({ scenarios: createMahjongScoringDemo() });
  });
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/ready", (_request, response) => response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" }));

  const presidentSockets = registerGameSocketHandlers(io, roomManager, gameCoordinator, { limiter, logger });
  const crazyEightsSockets = registerCrazyEightsSocketHandlers(io, roomManager, crazyEightsCoordinator, { limiter, logger });
  const mahjongSockets = registerMahjongSocketHandlers(io, roomManager, mahjongCoordinator, { limiter, logger });
  const coordinatorRouter = {
    maybeStart(roomCode) {
      const room = roomManager.getRoom(roomCode);
      if (room?.gameId === "crazy-eights") return crazyEightsCoordinator.maybeStart(roomCode);
      if (room?.gameId === "mahjong") return mahjongCoordinator.maybeStart(roomCode);
      return gameCoordinator.maybeStart(roomCode);
    },
    beforePlayerRemoval(room, player) {
      if (room.gameId === "crazy-eights") return crazyEightsCoordinator.beforePlayerRemoval(room, player);
      if (room.gameId === "mahjong") return mahjongCoordinator.beforePlayerRemoval(room, player);
      return gameCoordinator.beforePlayerRemoval(room, player);
    },
    setNextRoundReady(socketId, ready) {
      const control = roomManager.getControl(socketId);
      const room = control ? roomManager.getRoom(control.code) : null;
      if (room?.gameId === "crazy-eights") return crazyEightsCoordinator.setNextRoundReady(socketId, ready);
      if (room?.gameId === "mahjong") return mahjongCoordinator.setNextRoundReady(socketId, ready);
      return gameCoordinator.setNextRoundReady(socketId, ready);
    },
    getView: (roomCode, playerId) => gameCoordinator.getView(roomCode, playerId),
    getCrazyEightsView: (roomCode, playerId) => crazyEightsCoordinator.getView(roomCode, playerId),
    getMahjongView: (roomCode, playerId) => mahjongCoordinator.getView(roomCode, playerId),
    getExchangeView: (roomCode, playerId) => gameCoordinator.getExchangeView(roomCode, playerId),
    deleteRoom(roomCode) {
      gameCoordinator.deleteRoom(roomCode);
      crazyEightsCoordinator.deleteRoom(roomCode);
      mahjongCoordinator.deleteRoom(roomCode);
    },
  };
  const publish = (roomCode) => roomManager.getRoom(roomCode)?.gameId === "crazy-eights"
    ? crazyEightsSockets.publish(roomCode)
    : roomManager.getRoom(roomCode)?.gameId === "mahjong"
      ? mahjongSockets.publish(roomCode)
      : presidentSockets.publish(roomCode);
  registerRoomSocketHandlers(io, roomManager, coordinatorRouter, publish, { limiter, logger });
  io.on("connection", (socket) => {
    logger.info("socket_connected", { socketId: socket.id, address: socket.handshake.address });
  });
  httpServer.on("error", (error) => logger.error("http_server_error", { error: error.stack ?? String(error) }));

  const start = ({ port = config.port, host = "0.0.0.0" } = {}) => new Promise((resolve, reject) => {
    const onError = (error) => { httpServer.off("listening", onListening); reject(error); };
    const onListening = () => {
      httpServer.off("error", onError); ready = true;
      const address = httpServer.address();
      logger.info("server_started", { host, port: typeof address === "object" ? address.port : port, environment: config.nodeEnv });
      resolve(address);
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, host);
  });

  const stop = (signal = "shutdown") => {
    if (shutdownPromise) return shutdownPromise;
    ready = false;
    logger.info("server_shutdown_started", { signal });
    shutdownPromise = new Promise((resolve) => {
      roomManager.clear();
      gameCoordinator.clear();
      crazyEightsCoordinator.clear();
      mahjongCoordinator.clear();
      limiter.clearAll();
      io.close(() => {
        const finish = () => {
          if (forceTimer) clearTimeout(forceTimer);
          logger.info("server_shutdown_complete", { signal });
          resolve();
        };
        if (httpServer.listening) httpServer.close(finish);
        else finish();
      });
    });
    return shutdownPromise;
  };

  if (installSignalHandlers) {
    const shutdownFromSignal = (signal) => {
      forceTimer = setTimeout(() => {
        logger.error("server_shutdown_forced", { signal });
        process.exit(1);
      }, 5_000);
      forceTimer.unref();
      void stop(signal).then(() => { process.exitCode = 0; });
    };
    process.once("SIGINT", () => shutdownFromSignal("SIGINT"));
    process.once("SIGTERM", () => shutdownFromSignal("SIGTERM"));
  }
  return { app, httpServer, io, roomManager, gameCoordinator, crazyEightsCoordinator, mahjongCoordinator, limiter, start, stop, get ready() { return ready; } };
};

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  try {
    const application = createApplication({ installSignalHandlers: true });
    await application.start();
  } catch (error) {
    console.error({ level: "error", event: "startup_failed", error: error.stack ?? String(error) });
    process.exitCode = 1;
  }
}
