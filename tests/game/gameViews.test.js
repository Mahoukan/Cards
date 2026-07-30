import test from "node:test";
import assert from "node:assert/strict";
import { createDeck, createRound } from "../../src/game/index.js";
import { createGameView } from "../../src/game/gameViews.js";

const room = {
  code: "ABCD", status: "playing", hostPlayerId: "p1",
  players: [
    { id: "p1", name: "Alex", connected: true, socketId: "socket-secret", reconnectToken: "token-secret" },
    { id: "p2", name: "Morgan", connected: true, socketId: "other-secret", reconnectToken: "other-token" },
  ],
};
const state = createRound({ players: room.players.map(({ id, name }) => ({ id, name })), deck: createDeck() });
const session = { state, participants: room.players.map(({ id, name }) => ({ id, name })), revision: 2, turnDeadline: 30_000, results: null };

test("personalised view contains the player's full hand and opponent counts only", () => {
  const view = createGameView({ room, session, playerId: "p1", serverTime: 100 });
  assert.deepEqual(view.you.hand, state.players[0].hand);
  assert.equal(view.players[1].cardCount, state.players[1].hand.length);
  assert.equal("hand" in view.players[1], false);
});
test("opponent card identities and room secrets never appear", () => {
  const view = createGameView({ room, session, playerId: "p1", serverTime: 100 });
  const serialised = JSON.stringify(view);
  state.players[1].hand.forEach(({ id }) => assert.equal(serialised.includes(`"${id}"`), false));
  ["socket-secret", "other-secret", "token-secret", "other-token", "discardPile", "removedCards"].forEach((secret) => assert.equal(serialised.includes(secret), false));
});
test("public play, player state, host, and serialisability are exposed", () => {
  const played = state.players[0].hand[0];
  const altered = {
    ...state,
    currentPlay: { playerId: "p1", rank: played.rank, value: played.value, count: 1, cards: [played] },
    passedPlayerIds: ["p2"],
  };
  const view = createGameView({ room, session: { ...session, state: altered }, playerId: "p1", serverTime: 100 });
  assert.equal(view.currentPlay.cards[0].id, played.id);
  assert.equal(view.players[1].passed, true);
  assert.equal(view.players[0].isHost, true);
  assert.doesNotThrow(() => JSON.stringify(view));
});

test("jokers remain private in hands and are serialisable when publicly cleared", () => {
  const jokerOwner = state.players.find((player) => player.hand.some(({ isJoker }) => isJoker));
  const otherPlayerId = jokerOwner.id === "p1" ? "p2" : "p1";
  const joker = jokerOwner.hand.find(({ isJoker }) => isJoker);
  const privateView = createGameView({ room, session, playerId: otherPlayerId, serverTime: 100 });
  assert.equal(JSON.stringify(privateView).includes(joker.id), false);

  const publicState = {
    ...state,
    lastAction: { type: "joker_clear", playerId: jokerOwner.id, cards: [joker] },
  };
  const publicView = createGameView({
    room,
    session: { ...session, state: publicState },
    playerId: otherPlayerId,
    serverTime: 100,
  });
  assert.equal(publicView.lastAction.cards[0].id, joker.id);
  assert.equal(publicView.lastAction.cards[0].isJoker, true);
  assert.doesNotThrow(() => JSON.stringify(publicView));
});

test("special-rule views are public, personalised, private-safe, and serialisable", () => {
  const altered = {
    ...state,
    currentPlay: { playerId: "p1", rank: "10", value: 7, count: 1, cards: [{ id: "10-clubs", rank: "10", suit: "clubs", value: 7 }] },
    consecutiveActive: true,
    nextPlayOverride: { direction: "lower", playerId: "p2" },
    pilePlayHistory: [
      { rank: "9", rankValue: 6, count: 1, playerId: "p2" },
      { rank: "10", rankValue: 7, count: 1, playerId: "p1" },
    ],
  };
  const first = createGameView({ room, session: { ...session, state: altered }, playerId: "p1", serverTime: 100 });
  const second = createGameView({ room, session: { ...session, state: altered }, playerId: "p2", serverTime: 100 });
  assert.equal(first.consecutiveActive, true);
  assert.equal(first.requiredNextRank, "J");
  assert.deepEqual(first.nextPlayOverride, { direction: "lower", appliesToYou: false });
  assert.equal(second.requiredNextRank, "9");
  assert.deepEqual(second.nextPlayOverride, { direction: "lower", appliesToYou: true });
  assert.equal("pilePlayHistory" in first, false);
  const serialised = JSON.stringify(second);
  for (const secret of ["socket-secret", "token-secret", "other-token"]) assert.equal(serialised.includes(secret), false);
  assert.doesNotThrow(() => JSON.parse(serialised));
});
