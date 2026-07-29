import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { ERROR_CODES, MAXIMUM_PLAYERS, RECONNECT_GRACE_MS, ROOM_STATUS } from "./constants.js";
import { generateRoomCode } from "./roomCodes.js";
import { createPublicRoomView } from "./roomViews.js";
import { namesMatch, normaliseDisplayName, normaliseRoomCode } from "./validation.js";

const messages = {
  [ERROR_CODES.INVALID_DISPLAY_NAME]: "Enter a valid display name of 20 characters or fewer.",
  [ERROR_CODES.INVALID_ROOM_CODE]: "Enter a valid four-character room code.",
  [ERROR_CODES.ROOM_NOT_FOUND]: "That room could not be found.",
  [ERROR_CODES.ROOM_FULL]: "That room is full.",
  [ERROR_CODES.ROOM_NOT_JOINABLE]: "That room is not accepting players.",
  [ERROR_CODES.DISPLAY_NAME_TAKEN]: "That display name is already in use.",
  [ERROR_CODES.INVALID_SESSION]: "That saved room session is no longer valid.",
  [ERROR_CODES.NOT_IN_ROOM]: "You are not currently controlling a room player.",
  [ERROR_CODES.NOT_HOST]: "Only the host can remove a player.",
  [ERROR_CODES.CANNOT_KICK_SELF]: "Use Leave Room to remove yourself.",
  [ERROR_CODES.PLAYER_NOT_FOUND]: "That player could not be found.",
};
const failure = (code) => ({ ok: false, error: { code, message: messages[code] } });
const safeEqual = (first, second) => {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const a = Buffer.from(first); const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
};

export class RoomManager {
  constructor({
    now = Date.now,
    schedule = setTimeout,
    cancelSchedule = clearTimeout,
    random = Math.random,
    createId = randomUUID,
    createToken = () => randomBytes(32).toString("base64url"),
    graceMs = RECONNECT_GRACE_MS,
    onExpire = () => {},
  } = {}) {
    this.rooms = new Map();
    this.socketControls = new Map();
    this.removalTimers = new Map();
    this.now = now; this.schedule = schedule; this.cancelSchedule = cancelSchedule;
    this.random = random; this.createId = createId; this.createToken = createToken; this.graceMs = graceMs; this.onExpire = onExpire;
  }

  createRoom({ displayName, socketId }) {
    if (this.socketControls.has(socketId)) return failure(ERROR_CODES.ROOM_NOT_JOINABLE);
    const name = normaliseDisplayName(displayName);
    if (!name) return failure(ERROR_CODES.INVALID_DISPLAY_NAME);
    const code = generateRoomCode({ exists: (candidate) => this.rooms.has(candidate), random: this.random });
    const player = this.#createPlayer(name, socketId);
    const timestamp = this.now();
    const room = { code, status: ROOM_STATUS, hostPlayerId: player.id, createdAt: timestamp, updatedAt: timestamp, players: [player] };
    this.rooms.set(code, room); this.socketControls.set(socketId, { code, playerId: player.id });
    return this.#success(room, player);
  }

  joinRoom({ roomCode, displayName, socketId }) {
    if (this.socketControls.has(socketId)) return failure(ERROR_CODES.ROOM_NOT_JOINABLE);
    const code = normaliseRoomCode(roomCode);
    if (!code) return failure(ERROR_CODES.INVALID_ROOM_CODE);
    const name = normaliseDisplayName(displayName);
    if (!name) return failure(ERROR_CODES.INVALID_DISPLAY_NAME);
    const room = this.rooms.get(code);
    if (!room) return failure(ERROR_CODES.ROOM_NOT_FOUND);
    if (room.status !== ROOM_STATUS) return failure(ERROR_CODES.ROOM_NOT_JOINABLE);
    if (room.players.length >= MAXIMUM_PLAYERS) return failure(ERROR_CODES.ROOM_FULL);
    if (room.players.some((player) => namesMatch(player.name, name))) return failure(ERROR_CODES.DISPLAY_NAME_TAKEN);
    const player = this.#createPlayer(name, socketId);
    room.players.push(player); this.#touch(room);
    this.socketControls.set(socketId, { code, playerId: player.id });
    return this.#success(room, player);
  }

  resumeRoom({ roomCode, playerId, reconnectToken, socketId }) {
    const code = normaliseRoomCode(roomCode);
    const room = code ? this.rooms.get(code) : null;
    const player = room?.players.find(({ id }) => id === playerId);
    if (!player || !safeEqual(player.reconnectToken, reconnectToken)) return failure(ERROR_CODES.INVALID_SESSION);
    const replacedSocketId = player.connected && player.socketId !== socketId ? player.socketId : null;
    if (replacedSocketId) this.socketControls.delete(replacedSocketId);
    this.#cancelRemoval(code, player.id);
    player.socketId = socketId; player.connected = true; player.ready = false; player.disconnectedAt = null;
    this.socketControls.set(socketId, { code, playerId: player.id }); this.#touch(room);
    return { ...this.#success(room, player), replacedSocketId };
  }

  setReady({ socketId, ready }) {
    const controlled = this.#controlled(socketId);
    if (!controlled) return failure(ERROR_CODES.NOT_IN_ROOM);
    controlled.player.ready = Boolean(ready); this.#touch(controlled.room);
    return { ok: true, room: createPublicRoomView(controlled.room) };
  }

  kickPlayer({ socketId, playerId }) {
    const controlled = this.#controlled(socketId);
    if (!controlled) return failure(ERROR_CODES.NOT_IN_ROOM);
    if (controlled.room.hostPlayerId !== controlled.player.id) return failure(ERROR_CODES.NOT_HOST);
    if (playerId === controlled.player.id) return failure(ERROR_CODES.CANNOT_KICK_SELF);
    const target = controlled.room.players.find(({ id }) => id === playerId);
    if (!target) return failure(ERROR_CODES.PLAYER_NOT_FOUND);
    const removed = this.#removePlayer(controlled.room, target);
    return { ok: true, room: createPublicRoomView(controlled.room), removed };
  }

  leaveRoom({ socketId }) {
    const controlled = this.#controlled(socketId);
    if (!controlled) return failure(ERROR_CODES.NOT_IN_ROOM);
    const removed = this.#removePlayer(controlled.room, controlled.player);
    const room = this.rooms.get(controlled.room.code);
    return { ok: true, room: room ? createPublicRoomView(room) : null, removed };
  }

  disconnect(socketId) {
    const controlled = this.#controlled(socketId);
    if (!controlled) return null;
    const { room, player } = controlled;
    this.socketControls.delete(socketId);
    player.connected = false; player.ready = false; player.disconnectedAt = this.now();
    this.#touch(room);
    const timerKey = this.#timerKey(room.code, player.id);
    this.removalTimers.set(timerKey, this.schedule(() => {
      const result = this.expirePlayer(room.code, player.id);
      if (result) this.onExpire(result);
    }, this.graceMs));
    return { room: createPublicRoomView(room), code: room.code, playerId: player.id };
  }

  expirePlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    const player = room?.players.find(({ id }) => id === playerId);
    if (!room || !player || player.connected) return null;
    const removed = this.#removePlayer(room, player);
    const remaining = this.rooms.get(roomCode);
    return { removed, room: remaining ? createPublicRoomView(remaining) : null, code: roomCode };
  }

  getPublicRoom(code) {
    const room = this.rooms.get(code);
    return room ? createPublicRoomView(room) : null;
  }

  getControl(socketId) {
    const controlled = this.#controlled(socketId);
    return controlled ? { code: controlled.room.code, playerId: controlled.player.id } : null;
  }

  clear() {
    this.removalTimers.forEach((timer) => this.cancelSchedule(timer));
    this.removalTimers.clear(); this.socketControls.clear(); this.rooms.clear();
  }

  #createPlayer(name, socketId) {
    return { id: this.createId(), name, reconnectToken: this.createToken(), socketId, connected: true, ready: false, joinedAt: this.now(), disconnectedAt: null };
  }
  #success(room, player) {
    return { ok: true, session: { roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken }, room: createPublicRoomView(room) };
  }
  #controlled(socketId) {
    const control = this.socketControls.get(socketId);
    const room = control ? this.rooms.get(control.code) : null;
    const player = room?.players.find(({ id }) => id === control.playerId);
    return room && player && player.socketId === socketId && player.connected ? { room, player } : null;
  }
  #removePlayer(room, player) {
    this.#cancelRemoval(room.code, player.id);
    this.socketControls.delete(player.socketId);
    room.players = room.players.filter(({ id }) => id !== player.id);
    player.reconnectToken = null;
    if (!room.players.length) this.rooms.delete(room.code);
    else {
      if (room.hostPlayerId === player.id) room.hostPlayerId = this.#nextHost(room).id;
      this.#touch(room);
    }
    return { playerId: player.id, socketId: player.socketId, roomCode: room.code };
  }
  #nextHost(room) {
    return [...room.players].sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt - b.joinedAt)[0];
  }
  #touch(room) { room.updatedAt = this.now(); }
  #timerKey(code, playerId) { return `${code}:${playerId}`; }
  #cancelRemoval(code, playerId) {
    const key = this.#timerKey(code, playerId); const timer = this.removalTimers.get(key);
    if (timer !== undefined) this.cancelSchedule(timer);
    this.removalTimers.delete(key);
  }
}
