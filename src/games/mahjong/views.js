import { evaluateWinningHand } from "./validation.js";
import {
  findAddedKongCandidates, findChowCandidates, findConcealedKongCandidates,
  findDiscardKongCandidate, findPungCandidate,
} from "./melds.js";

const publicTile = ({ id, faceId, category, suit, rank, honorType, wind, dragon, bonusType, assetPath }) =>
  ({ id, faceId, category, suit, rank, honorType, wind, dragon, bonusType, assetPath });
const publicMeld = (meld) => ({ ...meld, tiles: meld.tiles.map(publicTile) });

const winningPreview = (state, player, tile, winSource) => {
  if (!tile) return null;
  const result = evaluateWinningHand({
    concealedTiles: winSource === "discard" || winSource === "robbed-kong"
      ? [...player.concealedTiles, tile] : player.concealedTiles,
    exposedMelds: player.exposedMelds, bonusTiles: player.bonusTiles,
    winningTile: tile, winSource, seatWind: player.seatWind, prevailingWind: state.prevailingWind,
  });
  return result.structurallyValid ? {
    available: result.qualifiesToWin,
    fan: result.bestResult?.scoring.totalFan ?? 0,
    handType: result.bestResult?.handType ?? null,
  } : { available: false, fan: 0, handType: null };
};

export const getClaimOptions = (state, playerId) => {
  const player = state.players.find(({ id }) => id === playerId);
  const discard = state.pendingDiscard?.tile;
  if (!player?.active || !discard || player.id === state.pendingDiscard.playerId) return null;
  const robbed = state.pendingClaims?.kind === "robbed-kong";
  const winSource = robbed ? "robbed-kong" : "discard";
  const mahjong = winningPreview(state, player, discard, winSource);
  const options = { pass: true, mahjong };
  if (robbed) return options;
  const pung = findPungCandidate(player.concealedTiles, discard);
  const kong = findDiscardKongCandidate(player.concealedTiles, discard);
  const discarderIndex = state.players.findIndex(({ id }) => id === state.pendingDiscard.playerId);
  const nextPlayerId = [...state.players.slice(discarderIndex + 1), ...state.players.slice(0, discarderIndex)]
    .find(({ active }) => active)?.id;
  return {
    ...options,
    pung: pung?.map(({ id }) => id) ?? null,
    kong: kong?.map(({ id }) => id) ?? null,
    chows: player.id === nextPlayerId
      ? findChowCandidates(player.concealedTiles, discard).map((candidate) => candidate.map(({ id }) => id))
      : [],
  };
};

export const createMahjongView = ({ room, session, playerId, serverTime }) => {
  const state = session.state;
  const own = state.players.find(({ id }) => id === playerId);
  const roomPlayers = new Map(room.players.map((player) => [player.id, player]));
  const ownTurn = own?.active && state.currentPlayerId === own.id
    && ["dealer-discard", "awaiting-discard"].includes(state.phase);
  const ownWin = ownTurn && state.lastDrawnTileId
    ? winningPreview(state, own, own.concealedTiles.find(({ id }) => id === state.lastDrawnTileId), state.lastDrawSource ?? "self-draw")
    : null;
  return {
    gameId: "mahjong", roomCode: room.code, roomStatus: room.status,
    roundNumber: state.roundNumber, handNumber: state.handNumber, revision: state.revision,
    serverTime, phase: state.phase, turnDeadline: session.turnDeadline, claimDeadline: session.claimDeadline,
    dealerPlayerId: state.dealerPlayerId, originalEastPlayerId: state.originalEastPlayerId,
    prevailingWind: state.prevailingWind, currentPlayerId: state.currentPlayerId,
    liveWallCount: state.liveWall.length, deadWallCount: state.deadWall.length,
    pendingDiscard: state.pendingDiscard ? { ...state.pendingDiscard, tile: publicTile(state.pendingDiscard.tile) } : null,
    lastAction: session.lastAction, roundResult: state.roundResult, matchComplete: state.matchComplete,
    rankings: state.matchComplete ? [...state.players].sort((a, b) => b.points - a.points).map(({ id, name, points }) => ({ id, name, points })) : null,
    players: state.players.map((player) => ({
      id: player.id, name: player.name, seatNumber: player.seatNumber, seatWind: player.seatWind,
      points: player.points, connected: roomPlayers.get(player.id)?.connected ?? false,
      active: player.active, isHost: room.hostPlayerId === player.id,
      concealedTileCount: player.concealedTiles.length,
      exposedMelds: player.exposedMelds.map(publicMeld),
      bonusTiles: player.bonusTiles.map(publicTile),
      discards: player.discards.map((discard) => ({ ...discard, tile: publicTile(discard.tile) })),
    })),
    you: own ? {
      id: own.id, name: own.name, active: own.active,
      concealedTiles: own.concealedTiles.map((tile) => ({
        ...publicTile(tile), newlyDrawn: tile.id === state.lastDrawnTileId,
        discardable: ownTurn,
      })),
      lastDrawnTileId: state.lastDrawnTileId,
      canDiscard: ownTurn, mahjong: ownWin,
      concealedKongs: ownTurn ? findConcealedKongCandidates(own.concealedTiles).map((group) => group.map(({ id }) => id)) : [],
      addedKongs: ownTurn ? findAddedKongCandidates(own.concealedTiles, own.exposedMelds).map(({ tile, pung }) => ({ tileId: tile.id, meldId: pung.id })) : [],
      claimOptions: state.phase === "claim-window" ? getClaimOptions(state, own.id) : null,
      privateMessage: session.privateMessages.get(own.id) ?? null,
    } : null,
  };
};
