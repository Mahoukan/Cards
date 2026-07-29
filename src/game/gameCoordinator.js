import { createRound, forfeitPlayer, passTurn, playCards, timeoutTurn } from "./gameEngine.js";
import { createExchangeSession, returnExchangeCards } from "./exchangeCoordinator.js";
import { ROLE_NAMES } from "./constants.js";
import { assignRoles } from "./roles.js";
import { createExchangeView } from "./exchangeViews.js";
import { createGameView } from "./gameViews.js";
import { TurnTimer } from "./turnTimer.js";
import { ROOM_STATUS } from "../rooms/constants.js";
import { canPrepareNextRound, canRoomStart, createPublicRoomView } from "../rooms/roomViews.js";

const failure = (code, message) => ({ ok: false, error: { code, message } });

export class GameCoordinator {
  constructor({ roomManager, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout, random = Math.random, deckFactory = null, onChange = () => {} } = {}) {
    this.roomManager = roomManager; this.now = now; this.random = random; this.deckFactory = deckFactory; this.onChange = onChange;
    this.sessions = new Map();
    this.exchangeSessions = new Map();
    this.timer = new TurnTimer({ now, schedule, cancelSchedule, onTimeout: (expected) => this.handleTimeout(expected) });
  }

  maybeStart(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || !canRoomStart(room) || this.sessions.has(roomCode)) return null;
    const participants = room.players.map(({ id, name }) => ({ id, name }));
    const deck = this.deckFactory?.(participants, 1);
    const state = createRound({ players: participants, ...(deck ? { deck } : {}), random: this.random });
    room.status = ROOM_STATUS.PLAYING;
    room.players.forEach((player) => { player.ready = false; });
    const session = { state, participants, revision: 1, startedAt: this.now(), completedAt: null, turnDeadline: null, results: null };
    this.sessions.set(roomCode, session);
    session.turnDeadline = this.timer.start(roomCode, state.currentPlayerId);
    this.onChange({ roomCode, type: "started" });
    return session;
  }

  play(socketId, cardIds) {
    if (!Array.isArray(cardIds) || cardIds.some((id) => typeof id !== "string")) return failure("INVALID_ACTION", "Choose valid card IDs.");
    return this.#act(socketId, (session, playerId) => playCards(session.state, playerId, cardIds));
  }

  pass(socketId) {
    return this.#act(socketId, (session, playerId) => passTurn(session.state, playerId));
  }

  handleTimeout({ roomCode, playerId, deadline }) {
    const session = this.sessions.get(roomCode);
    if (!session || session.turnDeadline !== deadline || session.state.currentPlayerId !== playerId || session.state.phase !== "playing") return false;
    const result = timeoutTurn(session.state, playerId);
    if (!result.ok) return false;
    this.#accept(roomCode, session, result.state, "update");
    return true;
  }

  forfeit(roomCode, playerId) {
    const session = this.sessions.get(roomCode);
    if (!session || session.state.phase === "complete") return null;
    const previousPlayer = session.state.currentPlayerId;
    const result = forfeitPlayer(session.state, playerId);
    if (!result.ok || result.state === session.state) return result;
    session.state = result.state; session.revision += 1;
    if (result.state.phase === "complete") this.#complete(roomCode, session);
    else if (result.state.currentPlayerId !== previousPlayer) session.turnDeadline = this.timer.start(roomCode, result.state.currentPlayerId);
    this.onChange({ roomCode, type: result.state.phase === "complete" ? "complete" : "update" });
    return { ok: true, revision: session.revision };
  }

  setNextRoundReady(socketId, ready) {
    const result = this.roomManager.setNextRoundReady({ socketId, ready });
    if (!result.ok) return result;
    const control = this.roomManager.getControl(socketId);
    const prepared = control ? this.maybePrepareNextRound(control.code) : null;
    return {
      ok: true,
      room: control ? this.roomManager.getPublicRoom(control.code) : result.room,
      exchange: prepared ? this.getExchangeView(control.code, control.playerId) : null,
    };
  }

  maybePrepareNextRound(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    const previousSession = this.sessions.get(roomCode);
    if (!room || !previousSession?.results || !canPrepareNextRound(room) || this.exchangeSessions.has(roomCode)) return null;
    const currentIds = new Set(room.players.map((player) => player.id));
    const filteredFinishOrder = previousSession.state.finishOrder.filter((playerId) => currentIds.has(playerId));
    if (filteredFinishOrder.length < 2) return null;
    const roles = assignRoles(filteredFinishOrder);
    const scumId = roles.find((assignment) => assignment.role === ROLE_NAMES.SCUM)?.playerId;
    const participants = room.players.map(({ id, name }) => ({ id, name }));
    const roundNumber = previousSession.state.roundNumber + 1;
    const deck = this.deckFactory?.(participants, roundNumber);
    const roundState = createRound({
      players: participants,
      ...(deck ? { deck } : {}),
      random: this.random,
      roundNumber,
      startingPlayerId: scumId,
      openingPlayRequired: false,
    });
    const exchange = createExchangeSession({
      roundState,
      roles,
      filteredFinishOrder,
      participants,
      nextStartingPlayerId: scumId,
      revision: previousSession.revision + 1,
      createdAt: this.now(),
    });
    room.status = ROOM_STATUS.EXCHANGE;
    this.roomManager.resetNextRoundReady(room);
    this.exchangeSessions.set(roomCode, exchange);
    this.onChange({ roomCode, type: "exchange" });
    return exchange;
  }

  returnExchangeCards(socketId, cardIds) {
    const control = this.roomManager.getControl(socketId);
    if (!control) return failure("NOT_IN_EXCHANGE", "You are not controlling an exchange player.");
    const room = this.roomManager.getRoom(control.code);
    if (!room || room.status !== ROOM_STATUS.EXCHANGE) return failure("NOT_IN_EXCHANGE", "This room is not exchanging cards.");
    const result = returnExchangeCards(this.exchangeSessions.get(control.code), control.playerId, cardIds);
    if (!result.ok) return result;
    this.exchangeSessions.set(control.code, result.session);
    if (result.session.allComplete) {
      this.#startPreparedRound(control.code, result.session);
      return { ok: true, revision: this.sessions.get(control.code).revision };
    }
    this.onChange({ roomCode: control.code, type: "exchange" });
    return { ok: true, revision: result.session.revision };
  }

  beforePlayerRemoval(room, player) {
    if (room.status === ROOM_STATUS.PLAYING) this.forfeit(room.code, player.id);
    else if (room.status === ROOM_STATUS.EXCHANGE) this.cancelExchange(room.code);
    else if (room.status === ROOM_STATUS.ROUND_COMPLETE) this.roomManager.resetNextRoundReady(room);
  }

  cancelExchange(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.status !== ROOM_STATUS.EXCHANGE) return null;
    this.exchangeSessions.delete(roomCode);
    room.status = ROOM_STATUS.ROUND_COMPLETE;
    this.roomManager.resetNextRoundReady(room);
    this.onChange({ roomCode, type: "exchangeCancelled" });
    return { ok: true };
  }

  getView(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode); const session = this.sessions.get(roomCode);
    return room && session ? createGameView({ room, session, playerId, serverTime: this.now() }) : null;
  }

  getExchangeView(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode); const session = this.exchangeSessions.get(roomCode);
    return room && session ? createExchangeView({ room, session, playerId, serverTime: this.now() }) : null;
  }

  getSession(roomCode) { return this.sessions.get(roomCode) ?? null; }
  getExchangeSession(roomCode) { return this.exchangeSessions.get(roomCode) ?? null; }
  getRoomView(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    return room ? createPublicRoomView(room) : null;
  }
  deleteRoom(roomCode) { this.timer.clear(roomCode); this.sessions.delete(roomCode); this.exchangeSessions.delete(roomCode); }
  clear() { this.timer.clearAll(); this.sessions.clear(); this.exchangeSessions.clear(); }

  #act(socketId, operation) {
    const control = this.roomManager.getControl(socketId);
    if (!control) return failure("NOT_IN_GAME", "You are not controlling an active player.");
    const room = this.roomManager.getRoom(control.code); const session = this.sessions.get(control.code);
    if (!room || room.status !== ROOM_STATUS.PLAYING || !session) return failure("GAME_NOT_ACTIVE", "This room does not have an active round.");
    const result = operation(session, control.playerId);
    if (!result.ok) return result;
    this.#accept(control.code, session, result.state, "update");
    return { ok: true, revision: session.revision };
  }

  #accept(roomCode, session, state, type) {
    session.state = state; session.revision += 1;
    if (state.phase === "complete") this.#complete(roomCode, session);
    else session.turnDeadline = this.timer.start(roomCode, state.currentPlayerId);
    this.onChange({ roomCode, type: state.phase === "complete" ? "complete" : type });
  }

  #complete(roomCode, session) {
    this.timer.clear(roomCode); session.turnDeadline = null; session.completedAt = this.now();
    const room = this.roomManager.getRoom(roomCode);
    if (room) {
      room.status = ROOM_STATUS.ROUND_COMPLETE;
      this.roomManager.resetNextRoundReady(room);
    }
    const roles = assignRoles(session.state.finishOrder);
    const names = new Map(session.participants.map((player) => [player.id, player.name]));
    const forfeited = new Set(session.state.forfeitedPlayerIds);
    session.results = roles.map(({ playerId, finishPosition, role }) => ({
      playerId, name: names.get(playerId), position: finishPosition, role,
      forfeited: forfeited.has(playerId),
    }));
  }

  #startPreparedRound(roomCode, exchange) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.status !== ROOM_STATUS.EXCHANGE) return null;
    const currentIds = new Set(room.players.map((player) => player.id));
    if (!exchange.participants.every((player) => currentIds.has(player.id))) {
      this.cancelExchange(roomCode);
      return null;
    }
    room.status = ROOM_STATUS.PLAYING;
    const previousRevision = this.sessions.get(roomCode)?.revision ?? exchange.revision;
    const session = {
      state: {
        ...exchange.roundState,
        currentPlayerId: exchange.nextStartingPlayerId,
        openingPlayRequired: false,
      },
      participants: exchange.participants,
      revision: Math.max(previousRevision + 1, exchange.revision + 1),
      startedAt: this.now(),
      completedAt: null,
      turnDeadline: null,
      results: null,
    };
    this.sessions.set(roomCode, session);
    this.exchangeSessions.delete(roomCode);
    session.turnDeadline = this.timer.start(roomCode, session.state.currentPlayerId);
    this.onChange({ roomCode, type: "started" });
    return session;
  }
}
