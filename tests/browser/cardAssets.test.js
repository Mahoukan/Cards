import assert from "node:assert/strict";
import test from "node:test";
import { getCardAssetUrl, isCardAssetId, isStandardCardId } from "../../public/js/ui/cardAssets.js";
import { cardLabel } from "../../public/js/ui/cardRenderer.js";

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["clubs", "diamonds", "hearts", "spades"];

test("asset mapper handles numeric, face, ace, every rank, and every suit", () => {
  assert.equal(getCardAssetUrl({ id: "7-hearts" }), "/assets/cards/7-hearts.svg");
  assert.equal(getCardAssetUrl({ id: "Q-clubs" }), "/assets/cards/Q-clubs.svg");
  assert.equal(getCardAssetUrl({ id: "A-spades" }), "/assets/cards/A-spades.svg");
  for (const rank of ranks) {
    for (const suit of suits) {
      const id = `${rank}-${suit}`;
      assert.equal(isStandardCardId(id), true);
      assert.equal(getCardAssetUrl({ id }), `/assets/cards/${id}.svg`);
    }
  }
});

test("asset mapper accepts exactly the two joker IDs", () => {
  assert.equal(isCardAssetId("joker-black"), true);
  assert.equal(isCardAssetId("joker-red"), true);
  assert.equal(getCardAssetUrl({ id: "joker-black" }), "/assets/cards/joker-black.svg");
  assert.equal(getCardAssetUrl({ id: "joker-red" }), "/assets/cards/joker-red.svg");
  assert.equal(cardLabel({ id: "joker-black", rank: "JOKER", suit: null, color: "black", isJoker: true }), "Black Joker");
  assert.equal(cardLabel({ id: "joker-red", rank: "JOKER", suit: null, color: "red", isJoker: true }), "Red Joker");
});

test("asset mapper safely rejects unknown jokers, paths, URLs, and malformed cards", () => {
  for (const id of [
    "joker-blue", "joker", "../A-spades", "cards/A-spades",
    "cards\\A-spades", "https://example.com/A-spades", "A-spades.svg", "",
  ]) assert.equal(getCardAssetUrl({ id }), null);
  assert.equal(getCardAssetUrl({}), null);
  assert.equal(getCardAssetUrl(null), null);
  assert.equal(getCardAssetUrl([]), null);
  assert.equal(getCardAssetUrl("A-spades"), null);
});
