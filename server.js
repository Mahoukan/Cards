import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
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

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.on("error", (error) => {
  console.error("Server error:", error);
  process.exitCode = 1;
});

httpServer.listen(port, host, () => {
  console.log(`President server listening on port ${port}`);
});

const shutDown = (signal) => {
  console.log(`${signal} received; shutting down`);
  io.close(() => {
    console.log("Server shut down");
  });
};

process.once("SIGINT", () => shutDown("SIGINT"));
process.once("SIGTERM", () => shutDown("SIGTERM"));
