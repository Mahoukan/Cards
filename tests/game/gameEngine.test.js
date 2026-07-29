import test from "node:test";
import assert from "node:assert/strict";
import {
  VALIDATION_CODES,
  createDeck,
  createRound,
  passTurn,
  playCards,
} from "../../src/game/index.js";

const allCards = new Map(createDeck().map((card) => [card.id, card]));
const card = (id) => ({ ...allCards.get(id) });
const player = (id, cardIds, finishPosition = null) => ({
  id,
  name: id.toUpperCase(),
  hand: cardIds.map(card),
  finishPosition,
});

function stateWith({
  players,
  currentPlayerId = players[0].id,
  currentPlay = null,
  passedPlayerIds = [],
  lastSuccessfulPlayerId = null,
  finishOrder = [],
  openingPlayRequired = false,
  phase = "playing",
}) {
  return {
    phase,
    roundNumber: 1,
    players,
    currentPlayerId,
    currentPlay,
    discardPile: [],
    passedPlayerIds,
    lastSuccessfulPlayerId,
    finishOrder,
    openingPlayRequired,
  };
}

const activePlay = (playerId, id) => {
  const playedCard = card(id);
  return {
    playerId,
    cards: [playedCard],
    rank: playedCard.rank,
    value: playedCard.value,
    count: 1,
  };
};

test("createRound starts the 3 of Clubs holder without mutating inputs", () => {
  const players = [
    { id: "p1", name: "One", metadata: "ignored" },
    { id: "p2", name: "Two" },
  ];
  const deck = createDeck();
  const originalPlayers = structuredClone(players);
  const originalDeck = structuredClone(deck);
  const round = createRound({ players, deck });
  assert.equal(round.currentPlayerId, "p1");
  assert.equal(round.openingPlayRequired, true);
  assert.equal(round.players[0].hand.length, 26);
  assert.deepEqual(players, originalPlayers);
  assert.deepEqual(deck, originalDeck);
});

test("createRound validates player counts and unique IDs", () => {
  assert.throws(() => createRound({ players: [{ id: "p1", name: "One" }] }));
  assert.throws(() => createRound({
    players: [
      { id: "p1", name: "One" },
      { id: "p1", name: "Duplicate" },
    ],
  }));
});

test("a normal play advances the turn and leaves the input immutable", () => {
  const state = stateWith({
    players: [player("p1", ["3-clubs", "5-clubs"]), player("p2", ["4-clubs", "6-clubs"])],
    openingPlayRequired: true,
  });
  const original = structuredClone(state);
  const result = playCards(state, "p1", ["3-clubs"]);
  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlayerId, "p2");
  assert.equal(result.state.openingPlayRequired, false);
  assert.equal(result.state.discardPile[0].id, "3-clubs");
  assert.deepEqual(state, original);
});

test("passing excludes a player until the pile clears and turn order wraps", () => {
  let state = stateWith({
    players: [
      player("p1", ["9-clubs", "10-clubs"]),
      player("p2", ["J-clubs"]),
      player("p3", ["Q-clubs"]),
    ],
    currentPlayerId: "p2",
    currentPlay: activePlay("p1", "8-clubs"),
    lastSuccessfulPlayerId: "p1",
  });
  state = passTurn(state, "p2").state;
  assert.deepEqual(state.passedPlayerIds, ["p2"]);
  assert.equal(state.currentPlayerId, "p3");
  state = playCards(state, "p3", ["Q-clubs"]).state;
  assert.equal(state.currentPlayerId, "p1");
  assert.equal(state.passedPlayerIds.includes("p2"), true);
});

test("everyone passing clears the pile and restores passed players", () => {
  let state = stateWith({
    players: [
      player("p1", ["9-clubs"]),
      player("p2", ["10-clubs"]),
      player("p3", ["J-clubs"]),
    ],
    currentPlayerId: "p2",
    currentPlay: activePlay("p1", "8-clubs"),
    lastSuccessfulPlayerId: "p1",
  });
  state = passTurn(state, "p2").state;
  state = passTurn(state, "p3").state;
  assert.equal(state.currentPlay, null);
  assert.deepEqual(state.passedPlayerIds, []);
  assert.equal(state.currentPlayerId, "p1");
});

test("a player who plays a two and retains cards leads again", () => {
  const state = stateWith({
    players: [player("p1", ["2-clubs", "4-clubs"]), player("p2", ["A-clubs", "5-clubs"])],
    currentPlay: activePlay("p2", "A-diamonds"),
  });
  const result = playCards(state, "p1", ["2-clubs"]);
  assert.equal(result.state.currentPlay, null);
  assert.equal(result.state.currentPlayerId, "p1");
});

test("a player finishing with a two does not lead again", () => {
  const state = stateWith({
    players: [
      player("p1", ["2-clubs"]),
      player("p2", ["4-clubs", "5-clubs"]),
      player("p3", ["6-clubs", "7-clubs"]),
    ],
    currentPlay: activePlay("p3", "A-clubs"),
  });
  const result = playCards(state, "p1", ["2-clubs"]);
  assert.equal(result.state.currentPlayerId, "p2");
  assert.deepEqual(result.state.finishOrder, ["p1"]);
});

test("the last successful finisher is skipped when passes clear the pile", () => {
  let state = stateWith({
    players: [
      player("p1", [], 1),
      player("p2", ["5-clubs", "6-clubs"]),
      player("p3", ["7-clubs", "8-clubs"]),
    ],
    currentPlayerId: "p2",
    currentPlay: activePlay("p1", "4-clubs"),
    lastSuccessfulPlayerId: "p1",
    finishOrder: ["p1"],
  });
  state = passTurn(state, "p2").state;
  state = passTurn(state, "p3").state;
  assert.equal(state.currentPlay, null);
  assert.equal(state.currentPlayerId, "p2");
});

test("finish order is recorded and the final player is assigned automatically", () => {
  const state = stateWith({
    players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"])],
    openingPlayRequired: true,
  });
  const result = playCards(state, "p1", ["3-clubs"]);
  assert.equal(result.state.phase, "complete");
  assert.deepEqual(result.state.finishOrder, ["p1", "p2"]);
  assert.deepEqual(result.state.players.map(({ finishPosition }) => finishPosition), [1, 2]);
  assert.equal(result.state.currentPlayerId, null);
});

test("finished and passed players are skipped across several positions", () => {
  const state = stateWith({
    players: [
      player("p1", [], 1),
      player("p2", ["5-clubs"]),
      player("p3", ["6-clubs"]),
      player("p4", ["7-clubs"]),
    ],
    currentPlayerId: "p4",
    currentPlay: activePlay("p2", "4-clubs"),
    passedPlayerIds: ["p2"],
    lastSuccessfulPlayerId: "p2",
    finishOrder: ["p1"],
  });
  const result = playCards(state, "p4", ["7-clubs"]);
  assert.equal(result.state.currentPlayerId, "p3");
});

test("passing on an empty pile is rejected without mutation", () => {
  const state = stateWith({
    players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"])],
  });
  const result = passTurn(state, "p1");
  assert.equal(result.error.code, VALIDATION_CODES.CANNOT_PASS_EMPTY_PILE);
  assert.strictEqual(result.state, state);
});

test("wrong-turn, finished-player, and complete-round actions are rejected", () => {
  const state = stateWith({
    players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"])],
  });
  assert.equal(playCards(state, "p2", ["4-clubs"]).error.code, VALIDATION_CODES.NOT_YOUR_TURN);

  const finishedState = stateWith({
    players: [player("p1", [], 1), player("p2", ["4-clubs"]), player("p3", ["5-clubs"])],
    currentPlayerId: "p1",
    finishOrder: ["p1"],
  });
  assert.equal(playCards(finishedState, "p1", []).error.code, VALIDATION_CODES.PLAYER_ALREADY_FINISHED);

  const completeState = { ...state, phase: "complete", currentPlayerId: null };
  assert.equal(passTurn(completeState, "p1").error.code, VALIDATION_CODES.ROUND_ALREADY_COMPLETE);
});

test("an invalid play does not partially mutate state", () => {
  const state = stateWith({
    players: [player("p1", ["3-clubs", "4-clubs"]), player("p2", ["5-clubs"])],
    openingPlayRequired: true,
  });
  const snapshot = structuredClone(state);
  const result = playCards(state, "p1", ["4-clubs"]);
  assert.equal(result.error.code, VALIDATION_CODES.OPENING_MUST_INCLUDE_3_OF_CLUBS);
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, snapshot);
});
