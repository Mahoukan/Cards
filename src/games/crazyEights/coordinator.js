import { ROOM_STATUS } from "../../rooms/constants.js";
import { canPrepareNextRound, canRoomStart } from "../../rooms/roomViews.js";
import { TurnTimer } from "../../game/turnTimer.js";
import {
  createCrazyEightsRound, drawCard, keepDrawnCard, playCard, removePlayer, timeoutTurn,
} from "./gameEngine.js";
import { createCrazyEightsView } from "./views.js";

const failure = (code, message) => ({ ok: false, error: { code, message } });

export class CrazyEightsCoordinator {
  constructor({
    roomManager, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout,
    turnDurationMs, random = Math.random, onChange = () => {},
  } = {}) {
    this.roomManager = roomManager;
    this.now = now;
    this.random = random;
    this.onChange = onChange;
    this.sessions = new Map();
    this.timer = new TurnTimer({
      now, schedule, cancelSchedule,
      ...(turnDurationMs === undefined ? {} : { durationMs: turnDurationMs }),
      onTimeout: (expected) => this.handleTimeout(expected),
    });
  }

  maybeStart(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.gameId !== "crazy-eights" || !canRoomStart(room) || this.sessions.has(roomCode)) return null;
    return this.#startRound(room, 1, 1);
  }

  play(socketId, cardId, chosenSuit) {
    return this.#act(socketId, (state, playerId) => playCard(state, playerId, [cardId], { chosenSuit }), (playerId, result) => ({
      type: "play", playerId, cardId, chosenSuit: chosenSuit ?? null, won: result.state.phase === "complete",
    }));
  }

  draw(socketId) {
    return this.#act(socketId, (state, playerId) => drawCard(state, playerId, { random: this.random }), (playerId, result) => ({
      type: "draw", playerId, drewCard: result.drewCard, decision: result.state.turnState === "drawn-card-decision",
    }));
  }

  keepDrawn(socketId) {
    return this.#act(socketId, (state, playerId) => keepDrawnCard(state, playerId), (playerId) => ({
      type: "keep_drawn", playerId,
    }));
  }

  handleTimeout({ roomCode, playerId, deadline }) {
    const session = this.sessions.get(roomCode);
    if (!session || session.turnDeadline !== deadline || session.state.currentPlayerId !== playerId || session.state.phase !== "playing") return false;
    const result = timeoutTurn(session.state, playerId, { random: this.random });
    if (!result.ok) return false;
    this.#accept(roomCode, session, result.state, {
      type: "timeout", playerId, drewCard: result.drewCard ?? session.state.turnState === "drawn-card-decision",
    });
    return true;
  }

  beforePlayerRemoval(room, player) {
    if (room.gameId !== "crazy-eights") return null;
    const session = this.sessions.get(room.code);
    if (!session || session.state.phase === "complete") return null;
    const previousCurrent = session.state.currentPlayerId;
    const result = removePlayer(session.state, player.id, { random: this.random });
    if (!result.ok) return result;
    session.lastAction = { type: "forfeit", playerId: player.id };
    session.state = result.state;
    if (result.state.phase === "complete") this.#complete(room.code, session);
    else if (previousCurrent !== result.state.currentPlayerId) session.turnDeadline = this.timer.start(room.code, result.state.currentPlayerId);
    this.onChange({ roomCode: room.code, type: result.state.phase === "complete" ? "complete" : "update" });
    return { ok: true };
  }

  setNextRoundReady(socketId, ready) {
    const control = this.roomManager.getControl(socketId);
    const room = control ? this.roomManager.getRoom(control.code) : null;
    if (!room || room.gameId !== "crazy-eights") return failure("NOT_IN_CRAZY_EIGHTS", "This is not a Crazy Eights room.");
    const result = this.roomManager.setNextRoundReady({ socketId, ready });
    if (!result.ok) return result;
    if (canPrepareNextRound(room)) {
      const previous = this.sessions.get(room.code);
      const nextRevision = (previous?.state.revision ?? 0) + 1;
      this.#startRound(room, (previous?.state.roundNumber ?? 0) + 1, nextRevision);
    }
    return { ok: true, room: this.roomManager.getPublicRoom(room.code) };
  }

  getView(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode);
    const session = this.sessions.get(roomCode);
    return room?.gameId === "crazy-eights" && session
      ? createCrazyEightsView({ room, session, playerId, serverTime: this.now() })
      : null;
  }

  getSession(roomCode) { return this.sessions.get(roomCode) ?? null; }
  deleteRoom(roomCode) { this.timer.clear(roomCode); this.sessions.delete(roomCode); }
  clear() { this.timer.clearAll(); this.sessions.clear(); }

  #act(socketId, operation, actionFactory) {
    const control = this.roomManager.getControl(socketId);
    if (!control) return failure("NOT_IN_GAME", "You are not controlling an active player.");
    const room = this.roomManager.getRoom(control.code);
    const session = this.sessions.get(control.code);
    if (!room || room.gameId !== "crazy-eights" || room.status !== ROOM_STATUS.PLAYING || !session) {
      return failure("GAME_NOT_ACTIVE", "This room does not have an active Crazy Eights round.");
    }
    const previousPlayerId = session.state.currentPlayerId;
    const result = operation(session.state, control.playerId);
    if (!result.ok) return result;
    this.#accept(control.code, session, result.state, actionFactory(control.playerId, result), previousPlayerId);
    return { ok: true, revision: session.state.revision };
  }

  #accept(roomCode, session, state, lastAction, previousPlayerId = session.state.currentPlayerId) {
    session.state = state;
    session.lastAction = lastAction;
    if (state.phase === "complete") this.#complete(roomCode, session);
    else if (state.currentPlayerId !== previousPlayerId) session.turnDeadline = this.timer.start(roomCode, state.currentPlayerId);
    this.onChange({ roomCode, type: state.phase === "complete" ? "complete" : "update" });
  }

  #complete(roomCode, session) {
    this.timer.clear(roomCode);
    session.turnDeadline = null;
    const room = this.roomManager.getRoom(roomCode);
    if (room) {
      room.status = ROOM_STATUS.ROUND_COMPLETE;
      this.roomManager.resetNextRoundReady(room);
    }
    const activeCounts = new Map(session.state.players.map(({ id, hand }) => [id, hand.length]));
    session.results = session.participants.map((participant) => ({
      playerId: participant.id,
      name: participant.name,
      cardCount: activeCounts.get(participant.id) ?? 0,
      winner: participant.id === session.state.winnerPlayerId,
      forfeited: !activeCounts.has(participant.id),
    }));
  }

  #startRound(room, roundNumber, revision) {
    const participants = room.players.map(({ id, name }) => ({ id, name }));
    const state = createCrazyEightsRound({ players: participants, random: this.random, roundNumber });
    state.revision = revision;
    const session = { state, participants, turnDeadline: null, results: null, lastAction: null };
    room.status = ROOM_STATUS.PLAYING;
    room.players.forEach((player) => { player.ready = false; player.nextRoundReady = false; });
    this.sessions.set(room.code, session);
    session.turnDeadline = this.timer.start(room.code, state.currentPlayerId);
    this.onChange({ roomCode: room.code, type: "started" });
    return session;
  }
}
