import assert from "node:assert/strict";
import test from "node:test";
import { createConfig } from "../src/config.js";

test("configuration defaults are immutable and production-safe", () => {
  const config = createConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.roomReconnectGraceMs, 60_000);
  assert.equal(config.turnDurationMs, 30_000);
  assert.equal(config.socketActionLimit, 30);
  assert.equal(Object.isFrozen(config), true);
});

test("configuration accepts valid overrides and normalises an origin", () => {
  const config = createConfig({
    NODE_ENV: "production", PORT: "0", PUBLIC_ORIGIN: "https://cards.example/",
    LOG_LEVEL: "debug", ROOM_RECONNECT_GRACE_MS: "50", TURN_DURATION_MS: "60",
    SOCKET_ACTION_LIMIT: "2", SOCKET_ACTION_WINDOW_MS: "70",
  });
  assert.deepEqual(config, {
    nodeEnv: "production", port: 0, publicOrigin: "https://cards.example", logLevel: "debug",
    roomReconnectGraceMs: 50, turnDurationMs: 60, socketActionLimit: 2, socketActionWindowMs: 70,
  });
});

test("invalid numeric and origin configuration fails fast", () => {
  for (const source of [{ PORT: "no" }, { TURN_DURATION_MS: "-1" }, { SOCKET_ACTION_LIMIT: "0" }, { PUBLIC_ORIGIN: "https://example.com/path" }]) {
    assert.throws(() => createConfig(source));
  }
});

