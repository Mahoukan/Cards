import assert from "node:assert/strict";
import test from "node:test";
import { SocketActionLimiter, plainObject, socketRequest, validatePayload } from "../src/socketSupport.js";

test("payload validation accepts only plain objects and selected schema fields", () => {
  assert.equal(plainObject([]), false);
  assert.equal(validatePayload(null, {}).ok, false);
  assert.equal(validatePayload([], {}).ok, false);
  assert.equal(validatePayload({ ready: "yes" }, { ready: { type: "boolean" } }).ok, false);
  assert.equal(validatePayload({ cardIds: ["x", "y", "z"] }, { cardIds: { type: "stringArray", max: 2 } }).ok, false);
  assert.deepEqual(validatePayload({ ready: true, host: true }, { ready: { type: "boolean" } }).value, { ready: true });
});

test("socket action limits are per socket, reset by time, and clear on disconnect", () => {
  let now = 0;
  const limiter = new SocketActionLimiter({ limit: 2, windowMs: 10, now: () => now });
  assert.equal(limiter.take("a"), true);
  assert.equal(limiter.take("a"), true);
  assert.equal(limiter.take("a"), false);
  assert.equal(limiter.take("b"), true);
  now = 10;
  assert.equal(limiter.take("a"), true);
  limiter.clear("a");
  assert.equal(limiter.take("a"), true);
});

test("socket request boundary hides exceptions, acknowledges once, and tolerates missing acknowledgements", async () => {
  let listener;
  const logged = [];
  const socket = { id: "socket", on: (_event, next) => { listener = next; } };
  socketRequest({
    socket, event: "test", schema: {}, limiter: { take: () => true },
    logger: { error: (...args) => logged.push(args) },
    handler: () => { throw new Error("private stack detail"); },
  });
  assert.doesNotThrow(() => listener({}));
  const response = await new Promise((resolve) => listener({}, resolve));
  assert.equal(response.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(JSON.stringify(response).includes("private stack detail"), false);
  await Promise.resolve();
  assert.equal(logged.length, 1);
});
