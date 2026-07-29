import test from "node:test";
import assert from "node:assert/strict";
import {
  VALIDATION_CODES,
  createDeck,
  describePlay,
  playClearsPile,
  validatePlay,
} from "../../src/game/index.js";

const cards = new Map(createDeck().map((card) => [card.id, card]));
const getCards = (...ids) => ids.map((id) => cards.get(id));
const validate = (selectedCards, options = {}) => validatePlay({
  hand: options.hand ?? selectedCards,
  selectedCards,
  currentPlay: options.currentPlay ?? null,
  openingPlayRequired: options.openingPlayRequired ?? false,
});

test("single, pair, triple, and four-of-a-kind plays are valid", () => {
  for (const ids of [
    ["7-clubs"],
    ["7-clubs", "7-diamonds"],
    ["7-clubs", "7-diamonds", "7-hearts"],
    ["7-clubs", "7-diamonds", "7-hearts", "7-spades"],
  ]) {
    assert.equal(validate(getCards(...ids)).ok, true);
  }
});

test("mixed ranks are rejected", () => {
  assert.equal(
    validate(getCards("7-clubs", "8-clubs")).error.code,
    VALIDATION_CODES.MIXED_RANKS,
  );
});

test("duplicate IDs are rejected", () => {
  const card = cards.get("7-clubs");
  assert.equal(validate([card, card]).error.code, VALIDATION_CODES.DUPLICATE_CARD);
});

test("cards not owned are rejected", () => {
  assert.equal(
    validate(getCards("7-clubs"), { hand: getCards("8-clubs") }).error.code,
    VALIDATION_CODES.CARD_NOT_OWNED,
  );
});

test("empty selections are rejected", () => {
  assert.equal(validate([]).error.code, VALIDATION_CODES.EMPTY_SELECTION);
});

test("active plays require the same card count", () => {
  assert.equal(
    validate(getCards("8-clubs"), {
      currentPlay: describePlay(getCards("7-clubs", "7-diamonds")),
    }).error.code,
    VALIDATION_CODES.WRONG_CARD_COUNT,
  );
});

test("equal and lower ranks are rejected while a higher rank is accepted", () => {
  const currentPlay = describePlay(getCards("8-clubs"));
  assert.equal(
    validate(getCards("8-spades"), { currentPlay }).error.code,
    VALIDATION_CODES.RANK_NOT_HIGHER,
  );
  assert.equal(
    validate(getCards("7-clubs"), { currentPlay }).error.code,
    VALIDATION_CODES.RANK_NOT_HIGHER,
  );
  assert.equal(validate(getCards("9-clubs"), { currentPlay }).ok, true);
});

test("suits do not affect gameplay legality", () => {
  const currentPlay = describePlay(getCards("8-spades"));
  assert.equal(validate(getCards("9-clubs"), { currentPlay }).ok, true);
});

test("the opening play must include the 3 of Clubs", () => {
  assert.equal(
    validate(getCards("4-clubs"), { openingPlayRequired: true }).error.code,
    VALIDATION_CODES.OPENING_MUST_INCLUDE_3_OF_CLUBS,
  );
  assert.equal(validate(getCards("3-clubs"), { openingPlayRequired: true }).ok, true);
});

test("an opening pair, triple, or four containing the 3 of Clubs is accepted", () => {
  for (const ids of [
    ["3-clubs", "3-diamonds"],
    ["3-clubs", "3-diamonds", "3-hearts"],
    ["3-clubs", "3-diamonds", "3-hearts", "3-spades"],
  ]) {
    assert.equal(validate(getCards(...ids), { openingPlayRequired: true }).ok, true);
  }
});

test("twos clear only after satisfying normal play requirements", () => {
  const pairOfTwos = getCards("2-clubs", "2-diamonds");
  const valid = validate(pairOfTwos, {
    currentPlay: describePlay(getCards("A-clubs", "A-diamonds")),
  });
  assert.equal(valid.ok, true);
  assert.equal(playClearsPile(valid.play), true);
  assert.equal(
    validate(pairOfTwos, {
      currentPlay: describePlay(getCards("A-clubs")),
    }).error.code,
    VALIDATION_CODES.WRONG_CARD_COUNT,
  );
});

test("four of a kind does not automatically clear", () => {
  const play = describePlay(getCards("9-clubs", "9-diamonds", "9-hearts", "9-spades"));
  assert.equal(playClearsPile(play), false);
});
