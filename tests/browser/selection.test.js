import test from "node:test";
import assert from "node:assert/strict";
import { canAddToSelection, toggleCardSelection } from "../../public/js/ui/selection.js";

const cards = [
  { id: "7-hearts", rank: "7" },
  { id: "7-clubs", rank: "7" },
  { id: "8-spades", rank: "8" },
];

test("an empty selection accepts a card", () => {
  assert.equal(canAddToSelection([], cards[0]).allowed, true);
});

test("selection accepts matching ranks and rejects mixed ranks", () => {
  assert.equal(canAddToSelection([cards[0]], cards[1]).allowed, true);
  assert.equal(canAddToSelection([cards[0]], cards[2]).allowed, false);
});

test("toggle adds and removes cards without changing selection on rejection", () => {
  assert.deepEqual(toggleCardSelection([], cards[0], cards).ids, ["7-hearts"]);
  assert.deepEqual(toggleCardSelection(["7-hearts"], cards[0], cards).ids, []);
  assert.deepEqual(toggleCardSelection(["7-hearts"], cards[2], cards).ids, ["7-hearts"]);
});

test("exchange selection accepts mixed ranks up to the required count", () => {
  assert.deepEqual(toggleCardSelection(["7-hearts"], cards[2], cards, { mode: "exchange", max: 2 }).ids, ["7-hearts", "8-spades"]);
  assert.deepEqual(toggleCardSelection(["7-hearts", "8-spades"], cards[1], cards, { mode: "exchange", max: 2 }).ids, ["7-hearts", "8-spades"]);
});
