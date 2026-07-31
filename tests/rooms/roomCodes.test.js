import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_CODE_ALPHABET } from "../../src/rooms/constants.js";
import { generateRoomCode } from "../../src/rooms/roomCodes.js";

test("room codes have four allowed, unambiguous characters", () => {
  const code = generateRoomCode();
  assert.equal(code.length, 4);
  assert.ok([...code].every((character) => ROOM_CODE_ALPHABET.includes(character)));
});
test("injected randomness is deterministic", () => {
  assert.equal(generateRoomCode({ random: () => 0 }), "AAAA");
  assert.equal(generateRoomCode({ random: () => .999999 }), "9999");
});
test("collisions retry", () => {
  let call = 0;
  const random = () => call++ < 4 ? 0 : .1;
  assert.notEqual(generateRoomCode({ random, exists: (code) => code === "AAAA" }), "AAAA");
});
test("generation fails after the collision limit", () => {
  assert.throws(() => generateRoomCode({ random: () => 0, exists: () => true, maxAttempts: 2 }), /unique room code/);
});
