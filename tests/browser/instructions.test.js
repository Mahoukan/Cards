import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_INSTRUCTIONS,
  getGameInstructions,
  nextInstructionDialogState,
} from "../../public/js/games/instructions.js";

test("President instructions contain every required player-facing section", () => {
  const instructions = getGameInstructions("president");
  assert.equal(instructions.id, "president");
  assert.deepEqual(instructions.sections.map(([heading]) => heading), [
    "Objective", "Card order", "Round 1 opening", "Normal play", "Passing",
    "Twos", "Tens", "Consecutive", "Jokers", "Finishing", "Later rounds and exchanges", "Timer and connection",
  ]);
});

test("invalid instruction game IDs fail safely and catalog contains no private data", () => {
  assert.equal(getGameInstructions("crazy-eights"), null);
  const serialised = JSON.stringify(GAME_INSTRUCTIONS);
  for (const privateTerm of ["sessionToken", "socketId", "roomCode", "reconnectToken"]) {
    assert.equal(serialised.includes(privateTerm), false);
  }
});

test("instruction dialog state closes without losing its selected game", () => {
  const opened = nextInstructionDialogState({ open: false }, "open");
  assert.deepEqual(opened, { open: true, gameId: "president" });
  assert.deepEqual(nextInstructionDialogState(opened, "close"), { open: false, gameId: "president" });
});
