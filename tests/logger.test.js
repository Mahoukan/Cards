import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "../src/logger.js";

test("logger filters levels and emits structured records without adding private data", () => {
  const records = [];
  const sink = { info: (record) => records.push(record), error: (record) => records.push(record) };
  const logger = createLogger({ level: "info", sink });
  logger.debug("hidden", { reconnectToken: "not-called" });
  logger.info("room_created", { roomCode: "ABCD" });
  assert.equal(records.length, 1);
  assert.equal(records[0].event, "room_created");
  assert.equal(JSON.stringify(records).includes("reconnectToken"), false);
});

