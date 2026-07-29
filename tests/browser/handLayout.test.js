import test from "node:test";
import assert from "node:assert/strict";
import { calculateHandLayout } from "../../public/js/ui/handLayout.js";

test("empty and single-card hands have stable dimensions", () => {
  assert.deepEqual(calculateHandLayout({ containerWidth: 300, cardWidth: 72, cardCount: 0 }), { step: 0, visibleWidth: 0, contentWidth: 0, scroll: false });
  assert.deepEqual(calculateHandLayout({ containerWidth: 300, cardWidth: 72, cardCount: 1 }), { step: 72, visibleWidth: 72, contentWidth: 72, scroll: false });
});

test("cards overlap to fit when a readable strip remains", () => {
  const result = calculateHandLayout({ containerWidth: 300, cardWidth: 72, cardCount: 6, minimumVisible: 30 });
  assert.equal(result.step, 45.6);
  assert.equal(result.contentWidth, 300);
  assert.equal(result.scroll, false);
});

test("large hands request horizontal scrolling and never return invalid sizes", () => {
  const result = calculateHandLayout({ containerWidth: 280, cardWidth: 72, cardCount: 26, minimumVisible: 30 });
  assert.equal(result.step, 30);
  assert.equal(result.scroll, true);
  Object.values(result).filter((value) => typeof value === "number").forEach((value) => {
    assert.equal(Number.isNaN(value), false);
    assert.ok(value >= 0);
  });
});

test("invalid numeric inputs are safely normalised", () => {
  const result = calculateHandLayout({ containerWidth: undefined, cardWidth: -2, cardCount: Number.NaN });
  assert.deepEqual(result, { step: 0, visibleWidth: 0, contentWidth: 0, scroll: false });
});
