import { createRound, forfeitPlayer, passTurn, playCards, timeoutTurn } from "./gameEngine.js";
import { assignRoles } from "./roles.js";
import { createGameView } from "./gameViews.js";
import { TurnTimer } from "./turnTimer.js";
import { ROOM_STATUS } from "../rooms/constants.js";
import { canRoomStart, createPublicRoomView } from "../rooms/roomViews.js";

const failure = (code, message) => ({ ok: false, error: { code, message } });

export class GameCoordinator {
  constructor({ roomManager, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout, random = Math.random, deckFactory = null, onChange = () => {} } = {}) {
    this.roomManager = roomManager; this.now = now; this.random = random; this.deckFactory = deckFactory; this.onChange = onChange;
    this.sessions = new Map();
    this.timer = new TurnTimer({ now, schedule, cancelSchedule, onTimeout: (expected) => this.handleTimeout(expected) });
  }

  maybeStart(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || !canRoomStart(room) || this.sessions.has(roomCode)) return null;
    const participants = room.players.map(({ id, name }) => ({ id, name }));
    const deck = this.deckFactory?.(participants);
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

  getView(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode); const session = this.sessions.get(roomCode);
    return room && session ? createGameView({ room, session, playerId, serverTime: this.now() }) : null;
  }

  getSession(roomCode) { return this.sessions.get(roomCode) ?? null; }
  getRoomView(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    return room ? createPublicRoomView(room) : null;
  }
  deleteRoom(roomCode) { this.timer.clear(roomCode); this.sessions.delete(roomCode); }
  clear() { this.timer.clearAll(); this.sessions.clear(); }

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
    if (room) room.status = ROOM_STATUS.ROUND_COMPLETE;
    const roles = assignRoles(session.state.finishOrder);
    const names = new Map(session.participants.map((player) => [player.id, player.name]));
    const forfeited = new Set(session.state.forfeitedPlayerIds);
    session.results = roles.map(({ playerId, finishPosition, role }) => ({
      playerId, name: names.get(playerId), position: finishPosition, role,
      forfeited: forfeited.has(playerId),
    }));
  }
}
