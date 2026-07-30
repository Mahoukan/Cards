import test from "node:test";
import assert from "node:assert/strict";
import {
  canCallConsecutive, reconcileSpecialSelection, selectionNeedsDirection,
} from "../../public/js/ui/specialRules.js";

const hand = [
  { id: "10-clubs", rank: "10" }, { id: "10-hearts", rank: "10" },
  { id: "J-clubs", rank: "J" }, { id: "Q-clubs", rank: "Q" },
];

test("ten selection requires a mutually exclusive direction and changing rank clears it", () => {
  assert.equal(selectionNeedsDirection(["10-clubs", "10-hearts"], hand), true);
  assert.equal(selectionNeedsDirection(["J-clubs"], hand), false);
  assert.deepEqual(reconcileSpecialSelection({
    selectedIds: ["10-clubs"], hand, direction: "lower", consecutive: false, view: {},
  }), { direction: "lower", consecutive: false });
  assert.deepEqual(reconcileSpecialSelection({
    selectedIds: ["J-clubs"], hand, direction: "lower", consecutive: false, view: {},
  }), { direction: null, consecutive: false });
});

test("Consecutive option appears only for the authoritative opportunity and exact selected rank", () => {
  const view = { consecutiveAvailable: true, currentPlay: { rank: "10", count: 1 } };
  assert.equal(canCallConsecutive(["J-clubs"], hand, view), true);
  assert.equal(canCallConsecutive(["Q-clubs"], hand, view), false);
  assert.equal(canCallConsecutive(["J-clubs"], hand, { ...view, consecutiveAvailable: false }), false);
});

test("reconciliation preserves a valid rejected choice and clears unavailable Consecutive", () => {
  const available = { consecutiveAvailable: true, currentPlay: { rank: "10", count: 1 } };
  assert.deepEqual(reconcileSpecialSelection({
    selectedIds: ["J-clubs"], hand, direction: null, consecutive: true, view: available,
  }), { direction: null, consecutive: true });
  assert.deepEqual(reconcileSpecialSelection({
    selectedIds: ["J-clubs"], hand, direction: null, consecutive: true,
    view: { ...available, consecutiveAvailable: false },
  }), { direction: null, consecutive: false });
});
