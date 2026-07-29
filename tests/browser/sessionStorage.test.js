import test from "node:test";
import assert from "node:assert/strict";
import { clearRoomSession, readRoomSession, saveRoomSession, SESSION_STORAGE_KEY } from "../../public/js/network/sessionStorage.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
};

test("room sessions round-trip through storage", () => {
  const storage = createStorage();
  const session = { roomCode: "ABCD", playerId: "player", reconnectToken: "secret" };
  assert.equal(saveRoomSession(session, storage), true);
  assert.deepEqual(readRoomSession(storage), session);
  assert.equal(clearRoomSession(storage), true);
  assert.equal(readRoomSession(storage), null);
});
test("malformed or incomplete saved sessions are ignored", () => {
  const storage = createStorage();
  storage.values.set(SESSION_STORAGE_KEY, "{bad");
  assert.equal(readRoomSession(storage), null);
  storage.values.set(SESSION_STORAGE_KEY, JSON.stringify({ roomCode: "ABCD" }));
  assert.equal(readRoomSession(storage), null);
});
test("unavailable storage fails safely", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(readRoomSession(storage), null);
  assert.equal(saveRoomSession({}, storage), false);
  assert.equal(clearRoomSession(storage), false);
});
