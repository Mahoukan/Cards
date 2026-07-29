import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { RoomManager, registerRoomSocketHandlers } from "./src/rooms/index.js";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const roomManager = new RoomManager();
const port = process.env.PORT || 3000;
const host = "0.0.0.0";
const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public",
);

app.use(express.static(publicDirectory));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

registerRoomSocketHandlers(io, roomManager);

httpServer.on("error", (error) => {
  console.error("Server error:", error);
  process.exitCode = 1;
});

httpServer.listen(port, host, () => {
  console.log(`President server listening on port ${port}`);
});

let shutdownPromise = null;

export const stopServer = (signal = "Shutdown") => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  console.log(`${signal} received; shutting down`);
  shutdownPromise = new Promise((resolve) => {
    roomManager.clear();
    io.close(() => {
      console.log("Server shut down");
      resolve();
    });
  });
  return shutdownPromise;
};

process.once("SIGINT", () => {
  void stopServer("SIGINT");
});
process.once("SIGTERM", () => {
  void stopServer("SIGTERM");
});
