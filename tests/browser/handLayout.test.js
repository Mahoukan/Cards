import test from "node:test";
import assert from "node:assert/strict";
import { calculateHandLayout, getCardStackIndex } from "../../public/js/ui/handLayout.js";
import { toggleCardSelection } from "../../public/js/ui/selection.js";
import { readFile } from "node:fs/promises";

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
  const result = calculateHandLayout({ containerWidth: 280, cardWidth: 72, cardCount: 29, minimumVisible: 30 });
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

test("shared hand CSS reserves at least the configured selection lift", async () => {
  const css = await readFile(new URL("../../public/css/style.css", import.meta.url), "utf8");
  assert.match(css, /--card-selection-lift:\s*\.75rem/);
  assert.match(css, /top:\s*calc\(var\(--card-selection-lift\)\s*\+\s*\.2rem\)/);
  assert.match(css, /translateY\(calc\(-1 \* var\(--card-selection-lift/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /z-index:\s*calc\(var\(--card-stack-index,\s*0\)\s*\+\s*1\)/);
  assert.doesNotMatch(css, /\.playing-card\[aria-pressed="true"\][^{]*\{[^}]*z-index/s);
  assert.match(css, /\.playing-card:focus-visible::after/);
});

test("stable stack indices increase with hand order and do not change with selection", () => {
  const cards = Array.from({ length: 29 }, (_, index) => ({
    id: `card-${index}`,
    rank: index < 3 ? "7" : String(index),
  }));
  const indices = cards.map((_, index) => getCardStackIndex(index));
  assert.deepEqual(indices, Array.from({ length: 29 }, (_, index) => index));

  let selectedIds = [];
  for (const position of [0, 14, 28]) {
    selectedIds = toggleCardSelection(selectedIds, cards[position], cards, { mode: "exchange", max: 3 }).ids;
  }
  assert.deepEqual(cards.map((_, index) => getCardStackIndex(index)), indices);
  assert.ok(getCardStackIndex(0) < getCardStackIndex(14));
  assert.ok(getCardStackIndex(14) < getCardStackIndex(28));
});

test("multiple gameplay selections preserve their original relative stack order", () => {
  const cards = [
    { id: "7-clubs", rank: "7" },
    { id: "7-diamonds", rank: "7" },
    { id: "7-hearts", rank: "7" },
    { id: "8-clubs", rank: "8" },
  ];
  let selectedIds = toggleCardSelection([], cards[0], cards).ids;
  selectedIds = toggleCardSelection(selectedIds, cards[2], cards).ids;
  const selectedIndices = cards
    .map((card, index) => selectedIds.includes(card.id) ? getCardStackIndex(index) : null)
    .filter((index) => index !== null);
  assert.deepEqual(selectedIndices, [0, 2]);
});
