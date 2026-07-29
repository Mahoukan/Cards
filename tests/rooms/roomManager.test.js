import test from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../../src/rooms/roomManager.js";

const createHarness = () => {
  let time = 100;
  let sequence = 0;
  const jobs = new Map();
  const cancelled = [];
  const manager = new RoomManager({
    now: () => time++,
    random: () => 0,
    createId: () => `player-${++sequence}`,
    createToken: () => `token-${sequence}`,
    schedule: (callback) => { const id = `timer-${jobs.size + 1}`; jobs.set(id, callback); return id; },
    cancelSchedule: (id) => { cancelled.push(id); jobs.delete(id); },
  });
  return { manager, jobs, cancelled };
};
const setupTwo = () => {
  const harness = createHarness();
  const host = harness.manager.createRoom({ displayName: "Alex", socketId: "socket-1" });
  const guest = harness.manager.joinRoom({ roomCode: host.room.code, displayName: "Morgan", socketId: "socket-2" });
  return { ...harness, host, guest, code: host.room.code };
};

test("creation returns a private session and makes the creator host", () => {
  const { manager } = createHarness();
  const result = manager.createRoom({ displayName: " Alex ", socketId: "socket-1" });
  assert.equal(result.ok, true);
  assert.equal(result.room.hostPlayerId, result.session.playerId);
  assert.equal(result.room.players[0].isHost, true);
  assert.ok(result.session.reconnectToken);
  assert.equal(JSON.stringify(result.room).includes("reconnectToken"), false);
  assert.equal(JSON.stringify(result.room).includes("socketId"), false);
});
test("joining preserves order and duplicate names are case-insensitively rejected", () => {
  const { manager, host, guest } = setupTwo();
  assert.deepEqual(guest.room.players.map(({ name }) => name), ["Alex", "Morgan"]);
  assert.equal(manager.joinRoom({ roomCode: host.room.code, displayName: "aLeX", socketId: "s3" }).error.code, "DISPLAY_NAME_TAKEN");
});
test("one socket cannot control seats in multiple rooms", () => {
  const { manager, host } = setupTwo();
  assert.equal(manager.createRoom({ displayName: "Again", socketId: "socket-1" }).error.code, "ROOM_NOT_JOINABLE");
  assert.equal(manager.joinRoom({ roomCode: host.room.code, displayName: "Again", socketId: "socket-1" }).error.code, "ROOM_NOT_JOINABLE");
});
test("missing rooms and full rooms are rejected, including disconnected seats", () => {
  const { manager, host } = setupTwo();
  assert.equal(manager.joinRoom({ roomCode: "BBBB", displayName: "X", socketId: "x" }).error.code, "ROOM_NOT_FOUND");
  ["C", "D", "E", "F"].forEach((name, index) => manager.joinRoom({ roomCode: host.room.code, displayName: name, socketId: `s${index + 3}` }));
  manager.disconnect("s3");
  assert.equal(manager.joinRoom({ roomCode: host.room.code, displayName: "G", socketId: "s7" }).error.code, "ROOM_FULL");
});
test("ready requires two connected ready players and disconnect clears readiness", () => {
  const { manager, code } = setupTwo();
  assert.equal(manager.setReady({ socketId: "socket-1", ready: true }).room.canStart, false);
  assert.equal(manager.setReady({ socketId: "socket-2", ready: true }).room.canStart, true);
  assert.equal(manager.disconnect("socket-2").room.canStart, false);
  assert.equal(manager.getPublicRoom(code).players[1].ready, false);
});
test("a socket can only update its own ready state", () => {
  const { manager } = setupTwo();
  assert.equal(manager.setReady({ socketId: "unknown", ready: true }).error.code, "NOT_IN_ROOM");
  assert.equal(manager.setReady({ socketId: "socket-1", ready: true }).room.players[1].ready, false);
});
test("host can kick a guest; non-host and self-kicks are rejected", () => {
  const { manager, host, guest } = setupTwo();
  assert.equal(manager.kickPlayer({ socketId: "socket-2", playerId: host.session.playerId }).error.code, "NOT_HOST");
  assert.equal(manager.kickPlayer({ socketId: "socket-1", playerId: host.session.playerId }).error.code, "CANNOT_KICK_SELF");
  assert.equal(manager.kickPlayer({ socketId: "socket-1", playerId: guest.session.playerId }).room.playerCount, 1);
  assert.equal(manager.resumeRoom({ ...guest.session, socketId: "new" }).error.code, "INVALID_SESSION");
});
test("voluntary host leave transfers host to the earliest connected player", () => {
  const { manager, guest } = setupTwo();
  const result = manager.leaveRoom({ socketId: "socket-1" });
  assert.equal(result.room.hostPlayerId, guest.session.playerId);
});
test("host remains during grace and transfers after deterministic expiry", () => {
  const { manager, host, guest } = setupTwo();
  manager.disconnect("socket-1");
  assert.equal(manager.getPublicRoom(host.room.code).hostPlayerId, host.session.playerId);
  manager.expirePlayer(host.room.code, host.session.playerId);
  assert.equal(manager.getPublicRoom(host.room.code).hostPlayerId, guest.session.playerId);
});
test("valid resume cancels cleanup, resets ready, and latest socket replaces the old one", () => {
  const { manager, host, jobs, cancelled } = setupTwo();
  manager.setReady({ socketId: "socket-1", ready: true });
  manager.disconnect("socket-1");
  const resumed = manager.resumeRoom({ ...host.session, socketId: "socket-new" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.room.players[0].connected, true);
  assert.equal(resumed.room.players[0].ready, false);
  assert.equal(jobs.size, 0);
  assert.equal(cancelled.length, 1);
  const replaced = manager.resumeRoom({ ...host.session, socketId: "socket-newest" });
  assert.equal(replaced.replacedSocketId, "socket-new");
  assert.equal(manager.setReady({ socketId: "socket-new", ready: true }).error.code, "NOT_IN_ROOM");
});
test("invalid tokens, player IDs, and room codes cannot resume", () => {
  const { manager, host } = setupTwo();
  assert.equal(manager.resumeRoom({ ...host.session, reconnectToken: "wrong", socketId: "x" }).error.code, "INVALID_SESSION");
  assert.equal(manager.resumeRoom({ ...host.session, playerId: "wrong", socketId: "x" }).error.code, "INVALID_SESSION");
  assert.equal(manager.resumeRoom({ ...host.session, roomCode: "BBBB", socketId: "x" }).error.code, "INVALID_SESSION");
});
test("grace expiry removes offline players and an expired player cannot resume", () => {
  const { manager, guest, jobs } = setupTwo();
  manager.disconnect("socket-2");
  [...jobs.values()][0]();
  assert.equal(manager.getPublicRoom(guest.room.code).playerCount, 1);
  assert.equal(manager.resumeRoom({ ...guest.session, socketId: "new" }).error.code, "INVALID_SESSION");
});
test("leaving the final seat deletes the room and cancels timers on clear", () => {
  const { manager, host } = createHarness();
  const room = manager.createRoom({ displayName: "Alex", socketId: "socket-1" });
  manager.leaveRoom({ socketId: "socket-1" });
  assert.equal(manager.getPublicRoom(room.room.code), null);
  const next = manager.createRoom({ displayName: "Alex", socketId: "socket-2" });
  manager.disconnect("socket-2");
  manager.clear();
  assert.equal(manager.getPublicRoom(next.room.code), null);
});
