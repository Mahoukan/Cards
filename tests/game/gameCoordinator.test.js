import test from "node:test";
import assert from "node:assert/strict";
import { createDeck } from "../../src/game/deck.js";
import { GameCoordinator } from "../../src/game/gameCoordinator.js";
import { RoomManager } from "../../src/rooms/roomManager.js";

const harness = () => {
  let sequence = 0; let now = 1000;
  const jobs = new Map(); const cancelled = [];
  const manager = new RoomManager({
    now: () => now,
    random: () => 0,
    createId: () => `p${++sequence}`,
    createToken: () => `t${sequence}`,
    schedule: () => Symbol(),
    cancelSchedule: () => {},
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
  const host = manager.createRoom({ displayName: "Alex", socketId: "s1" });
  return { manager, coordinator, host, jobs, cancelled, changes, setNow: (value) => { now = value; } };
};
const readyTwo = () => {
  const value = harness();
  const guest = value.manager.joinRoom({ roomCode: value.host.room.code, displayName: "Morgan", socketId: "s2" });
  value.manager.setReady({ socketId: "s1", ready: true });
  value.manager.setReady({ socketId: "s2", ready: true });
  return { ...value, guest, code: value.host.room.code };
};

test("round starts once with ready connected players in stable order", () => {
  const { coordinator, manager, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  assert.equal(manager.getRoom(code).status, "playing");
  assert.deepEqual(session.participants.map(({ id }) => id), ["p1", "p2"]);
  assert.equal(session.state.currentPlayerId, "p1");
  assert.equal(session.turnDeadline, 31_000);
  assert.deepEqual(manager.getRoom(code).players.map(({ ready }) => ready), [false, false]);
  assert.equal(coordinator.maybeStart(code), null);
});
test("round does not start with one, unready, or disconnected players", () => {
  const single = harness();
  single.manager.setReady({ socketId: "s1", ready: true });
  assert.equal(single.coordinator.maybeStart(single.host.room.code), null);
  const two = readyTwo();
  two.manager.getRoom(two.code).players[1].ready = false;
  assert.equal(two.coordinator.maybeStart(two.code), null);
  two.manager.getRoom(two.code).players[1].ready = true;
  two.manager.getRoom(two.code).players[1].connected = false;
  assert.equal(two.coordinator.maybeStart(two.code), null);
});
test("legal play advances revision and resets timer; invalid play changes neither", () => {
  const { coordinator, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  const firstDeadline = session.turnDeadline;
  const invalid = coordinator.play("s2", ["3-diamonds"]);
  assert.equal(invalid.ok, false);
  assert.equal(session.revision, 1);
  assert.equal(session.turnDeadline, firstDeadline);
  const played = coordinator.play("s1", ["3-clubs"]);
  assert.equal(played.ok, true);
  assert.equal(session.revision, 2);
  assert.notEqual(session.turnDeadline, null);
  assert.equal(coordinator.play("s1", ["3-clubs"]).ok, false);
  assert.equal(session.revision, 2);
});

test("joker acceptance increments once and creates exactly one fresh timer; rejection changes neither", () => {
  const { coordinator, code, jobs, cancelled } = readyTwo();
  const session = coordinator.maybeStart(code);
  const byId = new Map(createDeck().map((card) => [card.id, card]));
  session.state = {
    ...session.state,
    players: [
      { ...session.state.players[0], hand: [{ ...byId.get("joker-black") }, { ...byId.get("4-clubs") }] },
      { ...session.state.players[1], hand: [{ ...byId.get("5-clubs") }, { ...byId.get("6-clubs") }] },
    ],
    currentPlayerId: "p1",
    currentPlay: {
      playerId: "p2", rank: "K", value: 10, count: 2,
      cards: [{ ...byId.get("K-clubs") }, { ...byId.get("K-diamonds") }],
    },
    openingPlayRequired: false,
  };
  const originalDeadline = session.turnDeadline;
  const originalJobs = jobs.size;
  const invalid = coordinator.play("s1", ["joker-black", "4-clubs"]);
  assert.equal(invalid.error.code, "JOKER_MUST_BE_PLAYED_ALONE");
  assert.equal(session.revision, 1);
  assert.equal(session.turnDeadline, originalDeadline);
  assert.equal(jobs.size, originalJobs);

  const accepted = coordinator.play("s1", ["joker-black"]);
  assert.equal(accepted.ok, true);
  assert.equal(session.revision, 2);
  assert.equal(session.state.currentPlay, null);
  assert.equal(session.state.currentPlayerId, "p1");
  assert.equal(cancelled.length, 1);
  assert.equal(jobs.size, 1);
});
test("ten direction rejection changes neither revision nor timer and acceptance changes each once", () => {
  const { coordinator, code, jobs, cancelled } = readyTwo();
  const session = coordinator.maybeStart(code);
  const byId = new Map(createDeck().map((card) => [card.id, card]));
  session.state = {
    ...session.state,
    players: [
      { ...session.state.players[0], hand: [{ ...byId.get("10-clubs") }, { ...byId.get("4-clubs") }] },
      { ...session.state.players[1], hand: [{ ...byId.get("5-clubs") }, { ...byId.get("6-clubs") }] },
    ],
    currentPlayerId: "p1", currentPlay: null, openingPlayRequired: false,
  };
  const deadline = session.turnDeadline;
  const originalJobs = jobs.size;
  assert.equal(coordinator.play("s1", ["10-clubs"]).error.code, "TEN_REQUIRES_DIRECTION");
  assert.equal(session.revision, 1);
  assert.equal(session.turnDeadline, deadline);
  assert.equal(jobs.size, originalJobs);
  assert.equal(coordinator.play("s1", ["10-clubs"], { direction: "lower" }).ok, true);
  assert.equal(session.revision, 2);
  assert.equal(cancelled.length, 1);
  assert.equal(jobs.size, 1);
  assert.deepEqual(session.state.nextPlayOverride, { direction: "lower", playerId: "p2" });
});
test("passing updates the next turn while an empty-pile pass is rejected", () => {
  const { coordinator, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  assert.equal(coordinator.pass("s1").ok, false);
  coordinator.play("s1", ["3-clubs"]);
  assert.equal(coordinator.pass("s2").ok, true);
  assert.equal(session.state.currentPlay, null);
  assert.equal(session.state.currentPlayerId, "p1");
});
test("valid timeout advances, while stale timeout is ignored", () => {
  const { coordinator, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  const expected = { roomCode: code, playerId: session.state.currentPlayerId, deadline: session.turnDeadline };
  assert.equal(coordinator.handleTimeout({ ...expected, deadline: expected.deadline - 1 }), false);
  assert.equal(session.revision, 1);
  assert.equal(coordinator.handleTimeout(expected), true);
  assert.equal(session.revision, 2);
});
test("opening timeout increments once, replaces one timer, and exposes only the public card", () => {
  const { coordinator, code, jobs, cancelled } = readyTwo();
  const session = coordinator.maybeStart(code);
  const expected = { roomCode: code, playerId: session.state.currentPlayerId, deadline: session.turnDeadline };
  assert.equal(coordinator.handleTimeout(expected), true);
  assert.equal(session.revision, 2);
  assert.equal(cancelled.length, 1);
  assert.equal(jobs.size, 1);
  assert.deepEqual(session.state.currentPlay.cards.map(({ id }) => id), ["3-clubs"]);
  const publicView = coordinator.getView(code, "p2");
  assert.deepEqual(publicView.lastAction, { type: "opening_timeout", playerId: "p1", cardId: "3-clubs" });
  assert.equal(JSON.stringify(publicView.lastAction).includes("3-diamonds"), false);
  assert.equal(coordinator.handleTimeout(expected), false);
  assert.equal(session.revision, 2);
  assert.equal(jobs.size, 1);
});
test("resume/disconnect do not reset a game deadline and views restore the same hand", () => {
  const { coordinator, manager, host, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  const deadline = session.turnDeadline;
  const hand = coordinator.getView(code, "p1").you.hand;
  manager.disconnect("s1");
  const resumed = manager.resumeRoom({ ...host.session, socketId: "s1-new" });
  assert.equal(resumed.ok, true);
  assert.equal(session.turnDeadline, deadline);
  assert.deepEqual(coordinator.getView(code, "p1").you.hand, hand);
});
test("resume preserves Consecutive, a pending personalised override, and the deadline", () => {
  const { coordinator, manager, guest, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  session.state = {
    ...session.state,
    consecutiveActive: true,
    nextPlayOverride: { direction: "lower", playerId: "p2" },
    pilePlayHistory: [
      { rank: "9", rankValue: 6, count: 1, playerId: "p1" },
      { rank: "10", rankValue: 7, count: 1, playerId: "p2" },
    ],
  };
  const deadline = session.turnDeadline;
  manager.disconnect("s2");
  const resumed = manager.resumeRoom({ ...guest.session, socketId: "s2-new" });
  assert.equal(resumed.ok, true);
  const view = coordinator.getView(code, "p2");
  assert.equal(view.consecutiveActive, true);
  assert.deepEqual(view.nextPlayOverride, { direction: "lower", appliesToYou: true });
  assert.equal(session.turnDeadline, deadline);
  assert.deepEqual(session.state.nextPlayOverride, { direction: "lower", playerId: "p2" });
});
test("forfeiting the current player completes a two-player round with roles", () => {
  const { coordinator, manager, code } = readyTwo();
  coordinator.maybeStart(code);
  const result = coordinator.forfeit(code, "p1");
  const session = coordinator.getSession(code);
  assert.equal(result.ok, true);
  assert.equal(manager.getRoom(code).status, "round_complete");
  assert.deepEqual(session.results.map(({ role }) => role), ["President", "Scum"]);
  assert.equal(session.results[1].forfeited, true);
  assert.equal(session.turnDeadline, null);
});
test("normal final play completes the room and result names survive a later leave", () => {
  const { coordinator, manager, code } = readyTwo();
  const session = coordinator.maybeStart(code);
  const byId = new Map(createDeck().map((card) => [card.id, card]));
  session.state = {
    ...session.state,
    players: [
      { ...session.state.players[0], hand: [{ ...byId.get("3-clubs") }] },
      { ...session.state.players[1], hand: [{ ...byId.get("4-clubs") }] },
    ],
    currentPlayerId: "p1",
    currentPlay: null,
    openingPlayRequired: true,
  };
  assert.equal(coordinator.play("s1", ["3-clubs"]).ok, true);
  assert.equal(manager.getRoom(code).status, "round_complete");
  assert.deepEqual(session.results.map(({ name }) => name), ["Alex", "Morgan"]);
  manager.leaveRoom({ socketId: "s2" });
  assert.deepEqual(coordinator.getView(code, "p1").results.map(({ name }) => name), ["Alex", "Morgan"]);
});
