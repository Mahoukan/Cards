import test from "node:test";
import assert from "node:assert/strict";
import { normaliseRoomCode, validateDisplayName, formatCardCount, formatTimer } from "../../public/js/demo/demoController.js";

test("display names are trimmed and required", () => {
  assert.deepEqual(validateDisplayName("  Alex  "), { valid: true, value: "Alex", message: "" });
  assert.equal(validateDisplayName("   ").valid, false);
});

test("display names respect the maximum length", () => {
  assert.equal(validateDisplayName("a".repeat(21)).valid, false);
});

test("room codes ignore spaces, reject punctuation, uppercase and truncate", () => {
  assert.equal(normaliseRoomCode(" a b-1_c9 "), "AB1C");
});

test("count and timer formatters produce concise labels", () => {
  assert.equal(formatCardCount(1), "1 card");
  assert.equal(formatCardCount(3), "3 cards");
  assert.equal(formatTimer(7), "0:07");
  assert.equal(formatTimer(-2), "0:00");
});
