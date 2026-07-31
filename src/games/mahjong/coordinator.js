import { randomUUID } from "node:crypto";
import { ROOM_STATUS } from "../../rooms/constants.js";
import { canPrepareNextRound, canRoomStart } from "../../rooms/roomViews.js";
import { createMahjongRound } from "./setup.js";
import { drawReplacementTile } from "./wall.js";
import { isBonusTile, isChow, isKong, isPung } from "./rules.js";
import { calculatePayments } from "./payments.js";
import { evaluateMahjongDeclaration } from "./validation.js";
import { createMahjongView, getClaimOptions } from "./views.js";
import { sortMahjongTiles } from "./tiles.js";

const CLAIM_MS = 10_000;
const STARTING_POINTS = 1000;
const failure = (code, message) => ({ ok: false, error: { code, message } });

export class MahjongCoordinator {
  constructor({ roomManager, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout, turnDurationMs = 30_000, random = Math.random, onChange = () => {} } = {}) {
    Object.assign(this, { roomManager, now, schedule, cancelSchedule, turnDurationMs, random, onChange });
    this.sessions = new Map();
    this.timers = new Map();
  }

  maybeStart(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.gameId !== "mahjong" || !canRoomStart(room) || this.sessions.has(roomCode)) return null;
    const participants = room.players.map(({ id, name }) => ({ id, name }));
    const match = { participants, points: Object.fromEntries(participants.map(({ id }) => [id, STARTING_POINTS])), dealerPlayerId: participants[0].id, originalEastPlayerId: participants[0].id, dealerRotationCount: 0, roundsPlayed: 0 };
    return this.#startRound(room, match);
  }

  discard(socketId, tileId) {
    return this.#withPlayer(socketId, (room, session, player) => this.#discardPlayer(room, session, player, tileId));
  }

  claim(socketId, payload) {
    return this.#withPlayer(socketId, (room, session, player) => {
      const state = session.state;
      if (state.phase !== "claim-window" || !state.pendingClaims || state.pendingClaims.responses[player.id]) return failure("CLAIM_UNAVAILABLE", "No claim is available.");
      const options = getClaimOptions(state, player.id);
      if (!options) return failure("CLAIM_UNAVAILABLE", "You cannot claim this tile.");
      const type = payload?.type;
      if (!["pass", "mahjong", "pung", "kong", "chow"].includes(type)) return failure("INVALID_CLAIM", "Choose a valid claim.");
      if (type === "mahjong" && !options.mahjong?.available) return this.#falseMahjong(room, session, player, "The hand is incomplete or below 3 fan.");
      const ids = Array.isArray(payload.tileIds) ? payload.tileIds : [];
      if (type === "pung" && JSON.stringify(ids.slice().sort()) !== JSON.stringify((options.pung ?? []).slice().sort())) return failure("INVALID_CLAIM", "That Pung is not available.");
      if (type === "kong" && JSON.stringify(ids.slice().sort()) !== JSON.stringify((options.kong ?? []).slice().sort())) return failure("INVALID_CLAIM", "That Kong is not available.");
      if (type === "chow" && !(options.chows ?? []).some((candidate) => JSON.stringify(candidate.slice().sort()) === JSON.stringify(ids.slice().sort()))) return failure("INVALID_CLAIM", "That Chow is not available.");
      state.pendingClaims.responses[player.id] = { type, tileIds: ids };
      this.#accept(room, session, { type: "claim-submitted", playerId: player.id });
      if (this.#allClaimsAnswered(state)) this.#resolveClaims(room, session);
      return { ok: true, revision: state.revision };
    });
  }

  declareWin(socketId) {
    return this.#withPlayer(socketId, (room, session, player) => {
      const state = session.state;
      if (state.currentPlayerId !== player.id || state.phase !== "awaiting-discard" || !state.lastDrawnTileId) return failure("WIN_UNAVAILABLE", "Mahjong cannot be declared now.");
      const tile = player.concealedTiles.find(({ id }) => id === state.lastDrawnTileId);
      const declaration = this.#evaluate(state, player, tile, state.lastDrawSource ?? "self-draw", false);
      if (!declaration.valid) return this.#falseMahjong(room, session, player, declaration.code);
      this.#completeWin(room, session, player, declaration, state.lastDrawSource ?? "self-draw", null);
      return { ok: true, revision: state.revision };
    });
  }

  declareKong(socketId, payload) {
    return this.#withPlayer(socketId, (room, session, player) => {
      const state = session.state;
      if (state.currentPlayerId !== player.id || state.phase !== "awaiting-discard") return failure("KONG_UNAVAILABLE", "A Kong cannot be declared now.");
      if (payload?.type === "concealed") {
        const selected = this.#owned(player, payload.tileIds);
        if (!selected || !isKong(selected)) return failure("INVALID_KONG", "Select four equivalent concealed tiles.");
        this.#removeTiles(player, payload.tileIds);
        player.exposedMelds.push({ id: randomUUID(), type: "kong", kind: "concealed", exposed: false, tiles: selected });
        this.#replacementDraw(room, session, player, "kong-replacement");
        this.#accept(room, session, { type: "concealed-kong", playerId: player.id, faceId: selected[0].faceId });
        this.#startTurnTimer(room.code, session);
        return { ok: true, revision: state.revision };
      }
      if (payload?.type === "added") {
        const meld = player.exposedMelds.find(({ id, type }) => id === payload.meldId && type === "pung");
        const tile = player.concealedTiles.find(({ id }) => id === payload.tileId);
        if (!meld || !tile || tile.faceId !== meld.tiles[0].faceId) return failure("INVALID_KONG", "That Pung cannot be upgraded.");
        state.pendingDiscard = { tile, playerId: player.id, claimed: false, sequence: state.discardSequence };
        state.pendingKong = { playerId: player.id, meldId: meld.id, tileId: tile.id };
        state.pendingClaims = { kind: "robbed-kong", responses: {} };
        state.phase = "claim-window";
        this.#accept(room, session, { type: "added-kong-pending", playerId: player.id, faceId: tile.faceId });
        this.#startClaimTimer(room.code, session);
        return { ok: true, revision: state.revision };
      }
      return failure("INVALID_KONG", "Choose a concealed or added Kong.");
    });
  }

  handleTimeout(roomCode, token) {
    const session = this.sessions.get(roomCode);
    const record = this.timers.get(roomCode);
    if (!session || !record || record.token !== token) return false;
    this.timers.delete(roomCode);
    if (record.type === "claim") return this.#resolveClaims(this.roomManager.getRoom(roomCode), session);
    const player = session.state.players.find(({ id }) => id === record.playerId);
    if (!player?.active || session.state.currentPlayerId !== player.id) return false;
    const tile = player.concealedTiles.find(({ id }) => id === session.state.lastDrawnTileId) ?? sortMahjongTiles(player.concealedTiles).at(-1);
    if (!tile) return false;
    const result = this.#discardPlayer(this.roomManager.getRoom(roomCode), session, player, tile.id, "timeout-discard");
    return result.ok;
  }

  beforePlayerRemoval(room, roomPlayer) {
    if (room.gameId !== "mahjong") return null;
    const session = this.sessions.get(room.code);
    const player = session?.state.players.find(({ id }) => id === roomPlayer.id);
    if (!session || !player || session.state.roundResult) return null;
    player.active = false;
    session.privateMessages.delete(player.id);
    if (session.state.pendingClaims) session.state.pendingClaims.responses[player.id] = { type: "pass" };
    this.#accept(room, session, { type: "forfeit", playerId: player.id });
    this.#continueAfterForfeit(room, session, player.id);
    return { ok: true };
  }

  setNextRoundReady(socketId, ready) {
    const control = this.roomManager.getControl(socketId);
    const room = control ? this.roomManager.getRoom(control.code) : null;
    if (!room || room.gameId !== "mahjong") return failure("NOT_IN_MAHJONG", "This is not a Mahjong room.");
    const result = this.roomManager.setNextRoundReady({ socketId, ready });
    if (!result.ok) return result;
    if (canPrepareNextRound(room)) {
      const session = this.sessions.get(room.code);
      if (session.state.matchComplete) {
        const participants = room.players.map(({ id, name }) => ({ id, name }));
        session.match = { participants, points: Object.fromEntries(participants.map(({ id }) => [id, STARTING_POINTS])), dealerPlayerId: participants[0].id, originalEastPlayerId: participants[0].id, dealerRotationCount: 0, roundsPlayed: 0 };
      }
      this.#startRound(room, session.match);
    }
    return { ok: true, room: this.roomManager.getPublicRoom(room.code) };
  }

  getView(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode); const session = this.sessions.get(roomCode);
    return room?.gameId === "mahjong" && session ? createMahjongView({ room, session, playerId, serverTime: this.now() }) : null;
  }
  getSession(roomCode) { return this.sessions.get(roomCode) ?? null; }
  deleteRoom(roomCode) { this.#clearTimer(roomCode); this.sessions.delete(roomCode); }
  clear() { for (const code of this.sessions.keys()) this.#clearTimer(code); this.sessions.clear(); }

  #withPlayer(socketId, action) {
    const control = this.roomManager.getControl(socketId);
    const room = control ? this.roomManager.getRoom(control.code) : null;
    const session = room ? this.sessions.get(room.code) : null;
    const player = session?.state.players.find(({ id }) => id === control?.playerId);
    if (!room || room.gameId !== "mahjong" || !session || !player?.active) return failure("GAME_NOT_ACTIVE", "No active Mahjong player is controlled.");
    return action(room, session, player);
  }
  #discardPlayer(room, session, player, tileId, actionType = "discard") {
    const state = session.state;
    if (state.currentPlayerId !== player.id || !["dealer-discard", "awaiting-discard"].includes(state.phase)) return failure("INVALID_TURN", "You cannot discard now.");
    const index = player.concealedTiles.findIndex(({ id }) => id === tileId);
    if (index < 0) return failure("TILE_NOT_OWNED", "That tile is not in your hand.");
    const tile = player.concealedTiles[index];
    if (isBonusTile(tile)) return failure("BONUS_TILE", "Bonus tiles cannot be discarded.");
    player.concealedTiles.splice(index, 1);
    const discard = { tile, playerId: player.id, claimed: false, sequence: ++state.discardSequence };
    player.discards.push(discard); state.lastDrawnTileId = null;
    state.pendingDiscard = discard; state.pendingClaims = { kind: "discard", responses: {} }; state.phase = "claim-window";
    this.#accept(room, session, { type: actionType, playerId: player.id, tile: { id: tile.id, faceId: tile.faceId } });
    this.#startClaimTimer(room.code, session);
    return { ok: true, revision: state.revision };
  }
  #startRound(room, match) {
    const ordered = [...match.participants];
    const dealerIndex = ordered.findIndex(({ id }) => id === match.dealerPlayerId);
    const seated = [...ordered.slice(dealerIndex), ...ordered.slice(0, dealerIndex)].filter(({ id }) => room.players.some((player) => player.id === id));
    const state = createMahjongRound({ players: seated, dealerPlayerId: match.dealerPlayerId, random: this.random });
    state.roundNumber = match.roundsPlayed + 1; state.handNumber = state.roundNumber; state.revision = 1;
    state.discardSequence = 0; state.pendingDiscard = null; state.pendingClaims = null; state.pendingKong = null;
    state.roundResult = null; state.matchComplete = false; state.lastDrawSource = null;
    state.players.forEach((player) => { player.points = match.points[player.id]; player.active = true; });
    const session = { state, match, turnDeadline: null, claimDeadline: null, lastAction: { type: "round-started" }, privateMessages: new Map() };
    room.status = ROOM_STATUS.PLAYING; room.players.forEach((player) => { player.ready = false; player.nextRoundReady = false; });
    this.sessions.set(room.code, session); this.#startTurnTimer(room.code, session); this.onChange({ roomCode: room.code, type: "started" });
    return session;
  }
  #autoDraw(room, session, player) {
    const state = session.state;
    const tile = state.liveWall.shift();
    if (!tile) return this.#completeDraw(room, session);
    if (isBonusTile(tile)) {
      player.bonusTiles.push(tile);
      this.#replacementDraw(room, session, player, "self-draw");
    } else {
      player.concealedTiles.push(tile);
      state.lastDrawnTileId = tile.id;
      state.lastDrawSource = state.liveWall.length === 0 ? "last-live-tile" : "self-draw";
    }
    player.concealedTiles = sortMahjongTiles(player.concealedTiles);
    state.phase = "awaiting-discard";
    this.#accept(room, session, { type: "draw", playerId: player.id, bonusReplaced: isBonusTile(tile) });
    this.#startTurnTimer(room.code, session);
  }
  #replacementDraw(room, session, player, source) {
    let wall = { liveWall: session.state.liveWall, deadWall: session.state.deadWall };
    for (;;) {
      const result = drawReplacementTile(wall); wall = result.wall;
      if (!result.tile) { this.#completeDraw(room, session); return; }
      if (isBonusTile(result.tile)) { player.bonusTiles.push(result.tile); continue; }
      player.concealedTiles.push(result.tile); player.concealedTiles = sortMahjongTiles(player.concealedTiles);
      session.state.lastDrawnTileId = result.tile.id; session.state.lastDrawSource = source; break;
    }
    session.state.liveWall = wall.liveWall; session.state.deadWall = wall.deadWall; session.state.phase = "awaiting-discard";
  }
  #resolveClaims(room, session) {
    const state = session.state;
    if (!room || state.phase !== "claim-window") return false;
    this.#clearTimer(room.code);
    const discard = state.pendingDiscard; const responses = Object.entries(state.pendingClaims.responses)
      .filter(([, response]) => response.type !== "pass");
    const order = this.#activeAfter(state, discard.playerId).map(({ id }) => id);
    const priority = { mahjong: 3, kong: 2, pung: 2, chow: 1 };
    responses.sort(([aId, a], [bId, b]) => priority[b.type] - priority[a.type] || order.indexOf(aId) - order.indexOf(bId) || (b.type === "kong") - (a.type === "kong"));
    const winner = responses[0];
    if (!winner) {
      if (state.pendingClaims.kind === "robbed-kong") return this.#finishAddedKong(room, session);
      state.pendingDiscard = null; state.pendingClaims = null;
      const next = this.#activeAfter(state, discard.playerId)[0];
      if (!next) return this.#completeDraw(room, session);
      state.currentPlayerId = next.id; state.phase = "awaiting-draw";
      this.#autoDraw(room, session, next); return true;
    }
    const [playerId, claim] = winner; const player = state.players.find(({ id }) => id === playerId);
    if (claim.type === "mahjong") {
      const source = state.pendingClaims.kind === "robbed-kong" ? "robbed-kong" : "discard";
      const declaration = this.#evaluate(state, player, discard.tile, source, true);
      if (!declaration.valid) return this.#falseMahjong(room, session, player, declaration.code);
      this.#completeWin(room, session, player, declaration, source, discard.playerId); return true;
    }
    const selected = this.#owned(player, claim.tileIds);
    const meldTiles = selected ? [...selected, discard.tile] : [];
    const legal = claim.type === "chow" ? isChow(meldTiles) : claim.type === "pung" ? isPung(meldTiles) : isKong(meldTiles);
    if (!legal) { state.pendingClaims.responses[playerId] = { type: "pass" }; return this.#resolveClaims(room, session); }
    this.#removeTiles(player, claim.tileIds); discard.claimed = true;
    player.exposedMelds.push({ id: randomUUID(), type: claim.type, kind: "discard", exposed: true, sourcePlayerId: discard.playerId, claimedDiscardId: discard.tile.id, tiles: meldTiles });
    state.currentPlayerId = player.id; state.pendingDiscard = null; state.pendingClaims = null; state.phase = "awaiting-discard"; state.lastDrawnTileId = null;
    if (claim.type === "kong") this.#replacementDraw(room, session, player, "kong-replacement");
    this.#accept(room, session, { type: `${claim.type}-claimed`, playerId, faceId: discard.tile.faceId });
    this.#startTurnTimer(room.code, session); return true;
  }
  #finishAddedKong(room, session) {
    const pending = session.state.pendingKong;
    const player = session.state.players.find(({ id }) => id === pending.playerId);
    const meld = player.exposedMelds.find(({ id }) => id === pending.meldId);
    const tile = player.concealedTiles.find(({ id }) => id === pending.tileId);
    this.#removeTiles(player, [tile.id]); meld.type = "kong"; meld.kind = "added"; meld.tiles.push(tile);
    session.state.pendingDiscard = null; session.state.pendingClaims = null; session.state.pendingKong = null;
    this.#replacementDraw(room, session, player, "kong-replacement");
    this.#accept(room, session, { type: "added-kong", playerId: player.id, faceId: tile.faceId });
    this.#startTurnTimer(room.code, session); return true;
  }
  #evaluate(state, player, tile, source, addTile) {
    return evaluateMahjongDeclaration({ concealedTiles: addTile ? [...player.concealedTiles, tile] : player.concealedTiles, exposedMelds: player.exposedMelds, bonusTiles: player.bonusTiles, winningTile: tile, winSource: source, seatWind: player.seatWind, prevailingWind: state.prevailingWind });
  }
  #completeWin(room, session, player, declaration, source, responsiblePlayerId) {
    const fan = declaration.scoringResult.totalFan;
    const payment = calculatePayments({ playerIds: session.state.players.filter(({ active }) => active).map(({ id }) => id), winnerPlayerId: player.id, responsiblePlayerId, winSource: source, fan });
    for (const [id, delta] of Object.entries(payment.deltas)) session.match.points[id] += delta;
    const dealerContinues = player.id === session.state.dealerPlayerId;
    this.#completeRound(room, session, { outcome: "win", winnerPlayerId: player.id, winSource: source, responsiblePlayerId, handType: declaration.structuralResult.bestResult.handType, fan, scoringItems: declaration.scoringResult.items, paymentDeltas: payment.deltas, dealerContinues });
  }
  #completeDraw(room, session) { this.#completeRound(room, session, { outcome: "draw", paymentDeltas: {}, dealerContinues: true }); return true; }
  #completeRound(room, session, result) {
    this.#clearTimer(room.code); session.match.roundsPlayed += 1;
    if (!result.dealerContinues) {
      session.match.dealerRotationCount += 1;
      const ids = session.match.participants.map(({ id }) => id).filter((id) => room.players.some((player) => player.id === id));
      session.match.dealerPlayerId = ids[(ids.indexOf(session.match.dealerPlayerId) + 1) % ids.length];
    }
    session.state.matchComplete = !result.dealerContinues && session.match.dealerRotationCount >= session.match.participants.length;
    session.state.roundResult = { ...result, updatedPoints: { ...session.match.points }, nextDealerPlayerId: session.match.dealerPlayerId };
    session.state.phase = session.state.matchComplete ? "match-complete" : "round-complete";
    session.state.players.forEach((player) => { player.points = session.match.points[player.id]; });
    room.status = ROOM_STATUS.ROUND_COMPLETE; this.roomManager.resetNextRoundReady(room);
    this.#accept(room, session, { type: session.state.matchComplete ? "match-complete" : "round-complete" });
  }
  #falseMahjong(room, session, player, reason) {
    player.active = false; session.privateMessages.set(player.id, { code: reason, message: "Invalid Mahjong declaration. You forfeited this round." });
    this.#accept(room, session, { type: "false-mahjong", playerId: player.id });
    this.#continueAfterForfeit(room, session, player.id);
    return { ok: false, error: { code: "FALSE_MAHJONG", message: "Invalid Mahjong declaration; you forfeited this round.", reason } };
  }
  #continueAfterForfeit(room, session, playerId) {
    const active = session.state.players.filter(({ active }) => active);
    if (active.length === 1) {
      const winner = active[0];
      this.#completeRound(room, session, { outcome: "forfeit-win", winnerPlayerId: winner.id, fan: 0, scoringItems: [], paymentDeltas: {}, dealerContinues: winner.id === session.state.dealerPlayerId });
    } else if (!active.length) this.#completeDraw(room, session);
    else if (session.state.phase === "claim-window") {
      if (this.#allClaimsAnswered(session.state)) this.#resolveClaims(room, session);
    } else if (session.state.currentPlayerId === playerId) {
      const next = this.#activeAfter(session.state, playerId)[0]; session.state.currentPlayerId = next.id; this.#autoDraw(room, session, next);
    }
  }
  #allClaimsAnswered(state) { return state.players.filter(({ active, id }) => active && id !== state.pendingDiscard.playerId).every(({ id }) => state.pendingClaims.responses[id]); }
  #activeAfter(state, playerId) { const index = state.players.findIndex(({ id }) => id === playerId); return [...state.players.slice(index + 1), ...state.players.slice(0, index)].filter(({ active }) => active); }
  #owned(player, ids) { if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return null; const selected = ids.map((id) => player.concealedTiles.find((tile) => tile.id === id)); return selected.every(Boolean) ? selected : null; }
  #removeTiles(player, ids) { const set = new Set(ids); player.concealedTiles = player.concealedTiles.filter(({ id }) => !set.has(id)); }
  #accept(room, session, action) { session.state.revision += 1; session.lastAction = action; this.onChange({ roomCode: room.code, type: session.state.roundResult ? "complete" : "update" }); }
  #startTurnTimer(code, session) { this.#setTimer(code, "turn", session.state.currentPlayerId, this.turnDurationMs); session.turnDeadline = this.timers.get(code).deadline; session.claimDeadline = null; }
  #startClaimTimer(code, session) { this.#setTimer(code, "claim", null, CLAIM_MS); session.claimDeadline = this.timers.get(code).deadline; session.turnDeadline = null; }
  #setTimer(code, type, playerId, duration) { this.#clearTimer(code); const token = randomUUID(); const deadline = this.now() + duration; const handle = this.schedule(() => this.handleTimeout(code, token), duration); this.timers.set(code, { token, type, playerId, deadline, handle }); }
  #clearTimer(code) { const record = this.timers.get(code); if (record) this.cancelSchedule(record.handle); this.timers.delete(code); const session = this.sessions.get(code); if (session) { session.turnDeadline = null; session.claimDeadline = null; } }
}
