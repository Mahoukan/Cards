import test from "node:test";
import assert from "node:assert/strict";
import { createDeck, forfeitPlayer, passTurn, timeoutTurn } from "../../src/game/index.js";

const cards = new Map(createDeck().map((card) => [card.id, card]));
const player = (id, ids, finishPosition = null) => ({ id, name: id, hand: ids.map((cardId) => ({ ...cards.get(cardId) })), finishPosition });
const stateWith = ({
  players,
  currentPlayerId = players[0].id,
  currentPlay = null,
  lastSuccessfulPlayerId = null,
  passedPlayerIds = [],
  finishOrder = [],
}) => ({
  phase: "playing", roundNumber: 1, players, currentPlayerId, currentPlay,
  discardPile: [], passedPlayerIds, lastSuccessfulPlayerId, finishOrder,
  openingPlayRequired: false, forfeitedPlayerIds: [], forfeitOrder: [], removedCards: [],
});
const play = (playerId, id) => {
  const card = cards.get(id);
  return { playerId, cards: [{ ...card }], rank: card.rank, value: card.value, count: 1 };
};

test("empty-pile timeout advances without marking the player passed", () => {
  const state = stateWith({ players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"])] });
  const result = timeoutTurn(state, "p1");
  assert.equal(result.state.currentPlayerId, "p2");
  assert.deepEqual(result.state.passedPlayerIds, []);
  assert.deepEqual(result.state.players[0].hand, state.players[0].hand);
});
test("active-pile timeout behaves like an authoritative pass", () => {
  const state = stateWith({
    players: [player("p1", ["5-clubs"]), player("p2", ["6-clubs"]), player("p3", ["7-clubs"])],
    currentPlay: play("p3", "4-clubs"), lastSuccessfulPlayerId: "p3",
  });
  assert.deepEqual(timeoutTurn(state, "p1"), passTurn(state, "p1"));
});
test("invalid timeout leaves the state untouched", () => {
  const state = stateWith({ players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"])] });
  const result = timeoutTurn(state, "p2");
  assert.equal(result.ok, false);
  assert.strictEqual(result.state, state);
});
test("forfeit removes cards and reserves the worst remaining position", () => {
  const state = stateWith({ players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"]), player("p3", ["5-clubs"])] });
  const result = forfeitPlayer(state, "p2");
  assert.deepEqual(result.state.forfeitedPlayerIds, ["p2"]);
  assert.equal(result.state.players[1].hand.length, 0);
  assert.equal(result.state.players[1].finishPosition, 3);
  assert.deepEqual(result.state.removedCards.map(({ id }) => id), ["4-clubs"]);
  assert.equal(state.players[1].hand.length, 1);
});
test("multiple forfeits are ordered worst-first and complete the round", () => {
  let state = stateWith({
    players: [player("p1", ["3-clubs"]), player("p2", ["4-clubs"]), player("p3", ["5-clubs"]), player("p4", ["6-clubs"])],
  });
  state = forfeitPlayer(state, "p4").state;
  state = forfeitPlayer(state, "p3").state;
  state = forfeitPlayer(state, "p2").state;
  assert.equal(state.phase, "complete");
  assert.deepEqual(state.finishOrder, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.players.map(({ finishPosition }) => finishPosition), [1, 2, 3, 4]);
});
test("current-player forfeit advances and last-successful forfeit clears the pile", () => {
  const active = stateWith({
    players: [player("p1", ["5-clubs"]), player("p2", ["6-clubs"]), player("p3", ["7-clubs"])],
    currentPlayerId: "p1", currentPlay: play("p3", "4-clubs"), lastSuccessfulPlayerId: "p3",
  });
  assert.equal(forfeitPlayer(active, "p1").state.currentPlayerId, "p2");
  const leaderGone = forfeitPlayer(active, "p3").state;
  assert.equal(leaderGone.currentPlay, null);
  assert.equal(leaderGone.currentPlayerId, "p1");
});
test("finished players retain positions and duplicate forfeits are rejected", () => {
  const state = stateWith({
    players: [player("p1", [], 1), player("p2", ["4-clubs"]), player("p3", ["5-clubs"])],
    currentPlayerId: "p2", finishOrder: ["p1"],
  });
  assert.strictEqual(forfeitPlayer(state, "p1").state, state);
  const once = forfeitPlayer(state, "p2").state;
  assert.equal(forfeitPlayer(once, "p2").error.code, "PLAYER_ALREADY_FORFEITED");
});
