import test from "node:test";
import assert from "node:assert/strict";
import {
  RANKS,
  SUITS,
  createDeck,
  dealCards,
  findThreeOfClubsHolder,
  selectHighestCards,
  shuffleDeck,
  sortHand,
} from "../../src/game/index.js";

test("createDeck creates the complete standard deck", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((card) => card.id)).size, 52);
  assert.deepEqual(new Set(deck.map((card) => card.rank)), new Set(RANKS));
  assert.deepEqual(new Set(deck.map((card) => card.suit)), new Set(SUITS));
  assert.ok(deck.some((card) => card.id === "3-clubs"));
  assert.ok(deck.every((card) => !card.id.toLowerCase().includes("joker")));
});

test("dealCards deals every card with balanced hand sizes", () => {
  for (let playerCount = 2; playerCount <= 6; playerCount += 1) {
    const hands = dealCards(createDeck(), playerCount);
    const sizes = hands.map((hand) => hand.length);
    assert.equal(hands.flat().length, 52);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  }
});

test("dealCards deals one card at a time in player order", () => {
  const deck = createDeck();
  const hands = dealCards(deck, 3);
  assert.equal(hands[0][0].id, deck[0].id);
  assert.equal(hands[1][0].id, deck[1].id);
  assert.equal(hands[2][0].id, deck[2].id);
  assert.equal(hands[0][1].id, deck[3].id);
});

test("shuffleDeck is deterministic with an injected random function and immutable", () => {
  const deck = createDeck();
  const original = structuredClone(deck);
  const randomValues = [0.1, 0.8, 0.3, 0.6];
  const makeRandom = () => {
    let index = 0;
    return () => randomValues[index++ % randomValues.length];
  };
  assert.deepEqual(shuffleDeck(deck, makeRandom()), shuffleDeck(deck, makeRandom()));
  assert.deepEqual(deck, original);
});

test("sortHand orders by rank then clubs, diamonds, hearts, spades", () => {
  const deckById = new Map(createDeck().map((card) => [card.id, card]));
  const hand = ["A-spades", "3-hearts", "3-clubs", "2-diamonds", "A-clubs"]
    .map((id) => deckById.get(id));
  assert.deepEqual(
    sortHand(hand).map((card) => card.id),
    ["3-clubs", "3-hearts", "A-clubs", "A-spades", "2-diamonds"],
  );
});

test("findThreeOfClubsHolder returns the owning player", () => {
  const card = createDeck().find(({ id }) => id === "3-clubs");
  assert.equal(findThreeOfClubsHolder([
    { id: "a", hand: [] },
    { id: "b", hand: [card] },
  ]), "b");
});

test("selectHighestCards uses deterministic rank and suit ordering without mutation", () => {
  const deckById = new Map(createDeck().map((card) => [card.id, card]));
  const hand = ["2-clubs", "A-spades", "2-hearts", "3-clubs"]
    .map((id) => deckById.get(id));
  const original = structuredClone(hand);
  assert.deepEqual(
    selectHighestCards(hand, 3).map((card) => card.id),
    ["2-hearts", "2-clubs", "A-spades"],
  );
  assert.deepEqual(selectHighestCards(hand, 0), []);
  assert.deepEqual(hand, original);
});
