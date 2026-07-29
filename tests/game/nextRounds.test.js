import test from "node:test";
import assert from "node:assert/strict";
import { createDeck } from "../../src/game/deck.js";
import { ROLE_NAMES } from "../../src/game/constants.js";
import { GameCoordinator } from "../../src/game/gameCoordinator.js";
import { ROOM_STATUS } from "../../src/rooms/constants.js";
import { RoomManager } from "../../src/rooms/roomManager.js";

const harness = (playerCount = 2) => {
  let sequence = 0; let now = 1000;
  const jobs = new Map(); const cancelled = [];
  const manager = new RoomManager({
    now: () => now,
    random: () => 0,
    createId: () => `p${++sequence}`,
    createToken: () => `t${sequence}`,
    schedule: (callback) => { const handle = Symbol(); jobs.set(handle, callback); return handle; },
    cancelSchedule: (handle) => { cancelled.push(handle); jobs.delete(handle); },
  });
  const changes = [];
  const coordinator = new GameCoordinator({
    roomManager: manager,
    now: () => now,
    deckFactory: () => createDeck(),
    schedule: (callback) => { const handle = Symbol(); jobs.set(handle, callback); return handle; },
    cancelSchedule: (handle) => { cancelled.push(handle); jobs.delete(handle); },
    onChange: (change) => changes.push(change),
  });
  manager.onBeforeRemove = ({ room, player }) => coordinator.beforePlayerRemoval(room, player);
  const host = manager.createRoom({ displayName: "Alex", socketId: "s1" });
  for (let index = 2; index <= playerCount; index += 1) {
    manager.joinRoom({ roomCode: host.room.code, displayName: `P${index}`, socketId: `s${index}` });
  }
  const room = manager.getRoom(host.room.code);
  room.players.forEach((player, index) => { player.name = ["Alex", "Morgan", "Jamie", "Sam", "Taylor", "Riley"][index]; });
  return { manager, coordinator, host, code: host.room.code, room, changes, jobs, cancelled };
};

const completeArtificialRound = ({ coordinator, manager, code, finishOrder }) => {
  const room = manager.getRoom(code);
  const participants = room.players.map(({ id, name }) => ({ id, name }));
  const session = {
    state: {
      phase: "complete",
      roundNumber: 1,
      players: participants.map((player, index) => ({ ...player, hand: [], finishPosition: index + 1 })),
      currentPlayerId: null,
      currentPlay: null,
      discardPile: [],
      passedPlayerIds: [],
      lastSuccessfulPlayerId: null,
      finishOrder,
      forfeitedPlayerIds: [],
      forfeitOrder: [],
      removedCards: [],
      openingPlayRequired: false,
    },
    participants,
    revision: 7,
    startedAt: 1,
    completedAt: 2,
    turnDeadline: null,
    results: finishOrder.map((playerId, index) => ({ playerId, name: participants.find((player) => player.id === playerId).name, position: index + 1, role: "Old", forfeited: false })),
  };
  coordinator.sessions.set(code, session);
  room.status = ROOM_STATUS.ROUND_COMPLETE;
  manager.resetNextRoundReady(room);
  return session;
};

test("next-round readiness prepares exactly one exchange and resets readiness", () => {
  const value = harness(2);
  const ids = value.room.players.map((player) => player.id);
  completeArtificialRound({ ...value, finishOrder: ids });
  assert.deepEqual(value.room.players.map((player) => player.nextRoundReady), [false, false]);
  assert.equal(value.coordinator.setNextRoundReady("s1", true).ok, true);
  assert.equal(value.room.status, "round_complete");
  const prepared = value.coordinator.setNextRoundReady("s2", true);
  assert.equal(prepared.ok, true);
  assert.equal(value.room.status, "exchange");
  assert.deepEqual(value.room.players.map((player) => player.nextRoundReady), [false, false]);
  assert.equal(value.coordinator.setNextRoundReady("s2", true).ok, false);
  assert.equal(value.coordinator.getExchangeSession(value.code).roundState.roundNumber, 2);
});

test("role recalculation filters removed historical players and keeps previous results unchanged", () => {
  const value = harness(4);
  const ids = value.room.players.map((player) => player.id);
  const session = completeArtificialRound({ ...value, finishOrder: ids });
  const originalResults = session.results.map((result) => ({ ...result }));
  value.manager.leaveRoom({ socketId: "s2" });
  ["s1", "s3", "s4"].forEach((socketId) => value.coordinator.setNextRoundReady(socketId, true));
  const exchange = value.coordinator.getExchangeSession(value.code);
  assert.deepEqual(session.results, originalResults);
  assert.deepEqual(exchange.roles.map(({ playerId, role }) => [playerId, role]), [
    ["p1", ROLE_NAMES.PRESIDENT],
    ["p3", ROLE_NAMES.CITIZEN],
    ["p4", ROLE_NAMES.SCUM],
  ]);
  assert.equal(exchange.nextStartingPlayerId, "p4");
  assert.equal(exchange.requirements.length, 1);
});

test("automatic transfers move highest cards privately and preserve 52 unique cards", () => {
  const value = harness(4);
  const ids = value.room.players.map((player) => player.id);
  completeArtificialRound({ ...value, finishOrder: ids });
  value.room.players.forEach((player) => { player.nextRoundReady = true; });
  value.coordinator.maybePrepareNextRound(value.code);
  const exchange = value.coordinator.getExchangeSession(value.code);
  assert.equal(exchange.requirements.length, 2);
  const presidentRequirement = exchange.requirements.find((item) => item.returnCardCount === 2);
  const viceRequirement = exchange.requirements.find((item) => item.returnCardCount === 1);
  assert.deepEqual(presidentRequirement.givenCardIds, ["2-spades", "A-spades"]);
  assert.deepEqual(viceRequirement.givenCardIds, ["2-hearts"]);
  const allIds = exchange.roundState.players.flatMap((player) => player.hand.map((card) => card.id));
  assert.equal(allIds.length, 52);
  assert.equal(new Set(allIds).size, 52);
  assert.equal(value.coordinator.getView(value.code, "p1").roomStatus, "exchange");
  assert.equal(value.coordinator.getExchangeView(value.code, "p3").yourExchange.givenCards.length, 1);
  assert.equal(JSON.stringify(value.coordinator.getExchangeView(value.code, "p1")).includes("socketId"), false);
});

test("personalised exchange views hide unrelated exchanged cards and opponent hands", () => {
  const value = harness(5);
  const ids = value.room.players.map((player) => player.id);
  completeArtificialRound({ ...value, finishOrder: ids });
  value.room.players.forEach((player) => { player.nextRoundReady = true; });
  value.coordinator.maybePrepareNextRound(value.code);
  const exchange = value.coordinator.getExchangeSession(value.code);
  const presidentRequirement = exchange.requirements.find((item) => item.returnCardCount === 2);
  const viceRequirement = exchange.requirements.find((item) => item.returnCardCount === 1);
  const presidentView = value.coordinator.getExchangeView(value.code, "p1");
  const scumView = value.coordinator.getExchangeView(value.code, "p5");
  const citizenView = value.coordinator.getExchangeView(value.code, "p3");
  assert.equal(presidentView.yourExchange.receivedCards.length, 2);
  assert.equal(scumView.yourExchange.givenCards.length, 2);
  assert.equal(citizenView.yourExchange, null);
  assert.equal(citizenView.players.some((player) => "hand" in player), false);
  const citizenJson = JSON.stringify(citizenView);
  [...presidentRequirement.givenCardIds, ...viceRequirement.givenCardIds].forEach((cardId) => {
    assert.equal(citizenJson.includes(cardId), false);
  });
  assert.equal(citizenJson.includes("reconnectToken"), false);
  assert.equal(citizenJson.includes("roundState"), false);
});

test("return validation is authoritative and final return starts Scum-led Round 2", () => {
  const value = harness(2);
  const ids = value.room.players.map((player) => player.id);
  completeArtificialRound({ ...value, finishOrder: ids });
  value.room.players.forEach((player) => { player.nextRoundReady = true; });
  value.coordinator.maybePrepareNextRound(value.code);
  const exchange = value.coordinator.getExchangeSession(value.code);
  const presidentHand = value.coordinator.getExchangeView(value.code, "p1").you.hand;
  const beforeRevision = exchange.revision;
  assert.equal(value.coordinator.returnExchangeCards("s2", [presidentHand[0].id, presidentHand[1].id]).ok, false);
  assert.equal(value.coordinator.returnExchangeCards("s1", [presidentHand[0].id]).error.code, "WRONG_RETURN_CARD_COUNT");
  assert.equal(value.coordinator.returnExchangeCards("s1", [presidentHand[0].id, presidentHand[0].id]).error.code, "DUPLICATE_CARD");
  assert.equal(value.coordinator.getExchangeSession(value.code).revision, beforeRevision);
  const returned = value.coordinator.returnExchangeCards("s1", [presidentHand[0].id, presidentHand[1].id]);
  assert.equal(returned.ok, true);
  assert.equal(value.room.status, "playing");
  const next = value.coordinator.getSession(value.code);
  assert.equal(next.state.roundNumber, 2);
  assert.equal(next.state.currentPlayerId, "p2");
  assert.equal(next.state.openingPlayRequired, false);
  assert.equal(next.turnDeadline, 31_000);
  assert.equal(value.coordinator.getExchangeSession(value.code), null);
});

test("membership changes during exchange cancel prepared hands and require readiness again", () => {
  const value = harness(3);
  const ids = value.room.players.map((player) => player.id);
  completeArtificialRound({ ...value, finishOrder: ids });
  value.room.players.forEach((player) => { player.nextRoundReady = true; });
  value.coordinator.maybePrepareNextRound(value.code);
  assert.equal(value.room.status, "exchange");
  value.manager.kickPlayer({ socketId: "s1", playerId: "p2" });
  assert.equal(value.room.status, "round_complete");
  assert.equal(value.coordinator.getExchangeSession(value.code), null);
  assert.deepEqual(value.room.players.map((player) => player.nextRoundReady), [false, false]);
});
