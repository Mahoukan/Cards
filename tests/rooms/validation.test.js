import test from "node:test";
import assert from "node:assert/strict";
import { normaliseDisplayName, normaliseRoomCode } from "../../src/rooms/validation.js";

test("display names are trimmed and internal whitespace is collapsed", () => {
  assert.equal(normaliseDisplayName("  Alex   Morgan  "), "Alex Morgan");
});
test("empty, overlength, non-string, and control-character names are rejected", () => {
  assert.equal(normaliseDisplayName(" \t "), null);
  assert.equal(normaliseDisplayName("a".repeat(21)), null);
  assert.equal(normaliseDisplayName(42), null);
  assert.equal(normaliseDisplayName("Alex\u0000"), null);
});
test("Unicode display names remain supported", () => {
  assert.equal(normaliseDisplayName("  蓮 🌿  "), "蓮 🌿");
});
test("room codes are uppercased and spaces are ignored", () => {
  assert.equal(normaliseRoomCode(" a b c d "), "ABCD");
});
test("ambiguous, malformed, and non-string room codes are rejected", () => {
  ["ABC", "ABCDE", "AB0D", "ABID", "AB-D"].forEach((code) => assert.equal(normaliseRoomCode(code), null));
  assert.equal(normaliseRoomCode(null), null);
});
