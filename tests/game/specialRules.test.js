import test from "node:test";
import assert from "node:assert/strict";
import {
  VALIDATION_CODES, createDeck, forfeitPlayer, passTurn, playCards, timeoutTurn,
} from "../../src/game/index.js";

const cards = new Map(createDeck().map((card) => [card.id, card]));
const player = (id, ids) => ({ id, name: id, hand: ids.map((cardId) => ({ ...cards.get(cardId) })), finishPosition: null });
const publicPlay = (playerId, id, count = 1) => {
  const card = cards.get(id);
  return { playerId, cards: Array.from({ length: count }, () => ({ ...card })), rank: card.rank, value: card.value, count, isJoker: false };
};
const history = (...ranks) => ranks.map((rank, index) => ({
  rank, rankValue: ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"].indexOf(rank),
  count: 1, playerId: `h${index}`,
}));
const stateWith = ({
  players,
  currentPlayerId = players[0].id,
  currentPlay = null,
  consecutiveActive = false,
  nextPlayOverride = null,
  pilePlayHistory = [],
  passedPlayerIds = [],
  lastSuccessfulPlayerId = currentPlay?.playerId ?? null,
}) => ({
  phase: "playing", roundNumber: 2, players, currentPlayerId, currentPlay,
  discardPile: [], passedPlayerIds, lastSuccessfulPlayerId, finishOrder: [],
  forfeitedPlayerIds: [], forfeitOrder: [], removedCards: [], openingPlayRequired: false,
  consecutiveActive, nextPlayOverride, pilePlayHistory, lastAction: null,
});

test("single and paired tens require one valid direction without mutating rejected state", () => {
  for (const ids of [["10-clubs"], ["10-clubs", "10-diamonds"]]) {
    const state = stateWith({ players: [player("p1", [...ids, "4-clubs"]), player("p2", ["5-clubs", "6-clubs"])] });
    const snapshot = structuredClone(state);
    assert.equal(playCards(state, "p1", ids).error.code, VALIDATION_CODES.TEN_REQUIRES_DIRECTION);
    assert.equal(playCards(state, "p1", ids, { direction: 1 }).error.code, VALIDATION_CODES.INVALID_PLAY_DIRECTION);
    assert.equal(playCards(state, "p1", ids, { direction: "sideways" }).error.code, VALIDATION_CODES.INVALID_PLAY_DIRECTION);
    assert.deepEqual(state, snapshot);
    assert.equal(playCards(state, "p1", ids, { direction: "lower" }).ok, true);
  }
  const ordinary = stateWith({ players: [player("p1", ["5-clubs", "6-clubs"]), player("p2", ["7-clubs", "8-clubs"])] });
  assert.equal(playCards(ordinary, "p1", ["5-clubs"], { direction: "nonsense" }).ok, true);
});

test("10 Lower to 3 to 5 consumes the one-player override and resumes normal play", () => {
  let state = stateWith({
    players: [
      player("p1", ["10-clubs", "4-clubs"]),
      player("p2", ["2-clubs", "3-clubs", "6-clubs"]),
      player("p3", ["5-clubs", "7-clubs"]),
    ],
  });
  state = playCards(state, "p1", ["10-clubs"], { direction: "lower" }).state;
  assert.deepEqual(state.nextPlayOverride, { direction: "lower", playerId: "p2" });
  assert.equal(playCards(state, "p2", ["2-clubs"]).error.code, VALIDATION_CODES.RANK_NOT_LOWER);
  assert.deepEqual(state.nextPlayOverride, { direction: "lower", playerId: "p2" });
  state = playCards(state, "p2", ["3-clubs"]).state;
  assert.equal(state.nextPlayOverride, null);
  state = playCards(state, "p3", ["5-clubs"]).state;
  assert.equal(state.currentPlay.rank, "5");
});

test("Higher accepts any higher rank and pass, timeout, and current-turn forfeit consume an override", () => {
  const base = stateWith({
    players: [player("p1", ["10-clubs", "4-clubs"]), player("p2", ["A-clubs", "6-clubs"]), player("p3", ["J-clubs", "7-clubs"])],
  });
  const higher = playCards(base, "p1", ["10-clubs"], { direction: "higher" }).state;
  assert.equal(playCards(higher, "p2", ["A-clubs"]).ok, true);
  assert.equal(passTurn(higher, "p2").state.nextPlayOverride, null);
  assert.equal(timeoutTurn(higher, "p2").state.nextPlayOverride, null);
  const forfeited = forfeitPlayer(higher, "p2").state;
  assert.equal(forfeited.nextPlayOverride, null);
  assert.equal(forfeited.currentPlayerId, "p3");
});

test("three exactly ascending same-sized plays may activate Consecutive only once", () => {
  const singles = stateWith({
    players: [player("p1", ["9-clubs", "3-clubs"]), player("p2", ["4-clubs", "5-clubs"]), player("p3", ["6-clubs", "7-clubs"])],
    currentPlay: publicPlay("p3", "8-clubs"),
    pilePlayHistory: history("7", "8"),
  });
  const activated = playCards(singles, "p1", ["9-clubs"], { consecutive: true });
  assert.equal(activated.state.consecutiveActive, true);
  const alreadyActive = stateWith({
    players: [player("p1", ["10-clubs", "4-clubs"]), player("p2", ["5-clubs", "6-clubs"])],
    currentPlay: publicPlay("p2", "9-clubs"), consecutiveActive: true, pilePlayHistory: history("7", "8", "9"),
  });
  assert.equal(
    playCards(alreadyActive, "p1", ["10-clubs"], { direction: "higher", consecutive: true }).error.code,
    VALIDATION_CODES.CONSECUTIVE_NOT_AVAILABLE,
  );

  for (const ranks of [["7"], ["7", "9"], ["10", "9"]]) {
    const invalidState = stateWith({
      players: [player("p1", ["10-clubs", "4-clubs"]), player("p2", ["5-clubs", "6-clubs"])],
      currentPlay: publicPlay("p2", "9-clubs"),
      pilePlayHistory: history(...ranks),
    });
    assert.equal(
      playCards(invalidState, "p1", ["10-clubs"], { direction: "higher", consecutive: true }).error.code,
      VALIDATION_CODES.CONSECUTIVE_NOT_AVAILABLE,
    );
  }
});

test("ascending pairs can activate Consecutive and exact quantity remains required", () => {
  const pairHistory = [
    { rank: "7", rankValue: 4, count: 2, playerId: "p2" },
    { rank: "8", rankValue: 5, count: 2, playerId: "p3" },
  ];
  const state = stateWith({
    players: [
      player("p1", ["9-clubs", "9-diamonds", "4-clubs"]),
      player("p2", ["10-clubs", "10-diamonds", "5-clubs"]),
      player("p3", ["J-clubs", "J-diamonds", "6-clubs"]),
    ],
    currentPlay: { ...publicPlay("p3", "8-clubs", 2), cards: [{ ...cards.get("8-clubs") }, { ...cards.get("8-diamonds") }] },
    pilePlayHistory: pairHistory,
  });
  const active = playCards(state, "p1", ["9-clubs", "9-diamonds"], { consecutive: true }).state;
  assert.equal(active.consecutiveActive, true);
  assert.equal(playCards(active, "p2", ["10-clubs"], { direction: "higher" }).error.code, VALIDATION_CODES.WRONG_CARD_COUNT);
});

test("Consecutive exact sequence supports 9, 10 Lower, 9, 10 Higher, J, Q", () => {
  let state = stateWith({
    players: [
      player("p1", ["10-clubs", "Q-clubs", "3-clubs"]),
      player("p2", ["9-clubs", "4-clubs"]),
      player("p3", ["10-diamonds", "5-clubs"]),
      player("p4", ["J-clubs", "6-clubs"]),
    ],
    currentPlay: publicPlay("p4", "9-diamonds"),
    consecutiveActive: true,
    pilePlayHistory: history("7", "8", "9"),
  });
  state = playCards(state, "p1", ["10-clubs"], { direction: "lower" }).state;
  assert.deepEqual(state.nextPlayOverride, { direction: "lower", playerId: "p2" });
  state = playCards(state, "p2", ["9-clubs"]).state;
  assert.equal(state.consecutiveActive, true);
  assert.equal(state.nextPlayOverride, null);
  state = playCards(state, "p3", ["10-diamonds"], { direction: "higher" }).state;
  state = playCards(state, "p4", ["J-clubs"]).state;
  state = playCards(state, "p1", ["Q-clubs"]).state;
  assert.equal(state.currentPlay.rank, "Q");
  assert.equal(state.consecutiveActive, true);
});

test("a passed or timed-out Lower target leaves Consecutive active and requires J after 10", () => {
  const base = stateWith({
    players: [player("p1", ["4-clubs"]), player("p2", ["9-clubs", "5-clubs"]), player("p3", ["J-clubs", "6-clubs"])],
    currentPlayerId: "p2",
    currentPlay: publicPlay("p1", "10-clubs"),
    consecutiveActive: true,
    nextPlayOverride: { direction: "lower", playerId: "p2" },
    pilePlayHistory: history("9", "10"),
    lastSuccessfulPlayerId: "p1",
  });
  for (const resolve of [passTurn, timeoutTurn]) {
    const next = resolve(base, "p2").state;
    assert.equal(next.consecutiveActive, true);
    assert.equal(next.nextPlayOverride, null);
    assert.equal(next.currentPlayerId, "p3");
    assert.equal(playCards(next, "p3", ["J-clubs"]).ok, true);
  }
});

test("joker ignores direction, quantity, and Consecutive then clears every special field", () => {
  const state = stateWith({
    players: [player("p1", ["joker-black", "4-clubs"]), player("p2", ["5-clubs", "6-clubs"]), player("p3", ["7-clubs", "8-clubs"])],
    currentPlay: { ...publicPlay("p3", "10-clubs", 2), count: 2 },
    consecutiveActive: true,
    nextPlayOverride: { direction: "lower", playerId: "p1" },
    pilePlayHistory: history("9", "10"),
  });
  const next = playCards(state, "p1", ["joker-black"]).state;
  assert.equal(next.currentPlay, null);
  assert.equal(next.consecutiveActive, false);
  assert.equal(next.nextPlayOverride, null);
  assert.deepEqual(next.pilePlayHistory, []);
});

test("twos obey direction and exact Consecutive progression before clearing special state", () => {
  const players = [player("p1", ["2-clubs", "4-clubs"]), player("p2", ["5-clubs", "6-clubs"]), player("p3", ["7-clubs", "8-clubs"])];
  const higher = stateWith({ players, currentPlay: publicPlay("p3", "10-clubs"), nextPlayOverride: { direction: "higher", playerId: "p1" } });
  assert.equal(playCards(higher, "p1", ["2-clubs"]).state.currentPlay, null);
  const lower = { ...higher, nextPlayOverride: { direction: "lower", playerId: "p1" } };
  assert.equal(playCards(lower, "p1", ["2-clubs"]).error.code, VALIDATION_CODES.RANK_NOT_LOWER);
  const consecutive = stateWith({
    players, currentPlay: publicPlay("p3", "A-clubs"), consecutiveActive: true, pilePlayHistory: history("K", "A"),
  });
  const cleared = playCards(consecutive, "p1", ["2-clubs"]).state;
  assert.equal(cleared.currentPlay, null);
  assert.equal(cleared.consecutiveActive, false);
  assert.deepEqual(cleared.pilePlayHistory, []);
});

test("Consecutive advances exactly through Queen, King, Ace, and 2", () => {
  let state = stateWith({
    players: [
      player("p1", ["K-clubs", "A-spades", "3-clubs"]),
      player("p2", ["A-clubs", "4-clubs"]),
      player("p3", ["2-clubs", "5-clubs"]),
      player("p4", ["6-clubs", "7-clubs"]),
    ],
    currentPlay: publicPlay("p4", "Q-clubs"),
    consecutiveActive: true,
    pilePlayHistory: history("J", "Q"),
  });
  assert.equal(playCards(state, "p1", ["A-spades"]).error.code, VALIDATION_CODES.RANK_NOT_CONSECUTIVE);
  state = playCards(state, "p1", ["K-clubs"]).state;
  state = playCards(state, "p2", ["A-clubs"]).state;
  state = playCards(state, "p3", ["2-clubs"]).state;
  assert.equal(state.currentPlay, null);
  assert.equal(state.consecutiveActive, false);
  assert.deepEqual(state.pilePlayHistory, []);
});
