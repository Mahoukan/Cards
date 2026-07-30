import { GAME_ID, MAX_PLAYERS, MIN_PLAYERS, VALIDATION_CODES } from "./constants.js";
import {
  cardsPerPlayer, createCrazyEightsDeck, shuffleCrazyEightsDeck, validateCrazyEightsDeck,
} from "./deck.js";
import { isCardPlayable, validateCardPlay } from "./rules.js";

const MESSAGES = Object.freeze({
  [VALIDATION_CODES.NOT_YOUR_TURN]: "It is not this player's turn.",
  [VALIDATION_CODES.ROUND_ALREADY_COMPLETE]: "This round is already complete.",
  [VALIDATION_CODES.PLAYER_NOT_FOUND]: "The player is not in this round.",
  [VALIDATION_CODES.NO_DRAWN_CARD_DECISION]: "There is no drawn card to keep.",
  [VALIDATION_CODES.CANNOT_DRAW_TWICE]: "Only one card may be drawn per turn.",
  [VALIDATION_CODES.DRAW_NOT_AVAILABLE]: "No card is available to draw.",
});
const reject = (state, code) => ({ ok: false, error: { code, message: MESSAGES[code] }, state });
const advancePlayer = (state, afterPlayerId) => {
  const index = state.players.findIndex(({ id }) => id === afterPlayerId);
  return state.players[(index + 1) % state.players.length].id;
};
const validateAction = (state, playerId) => {
  if (state.phase === "complete") return reject(state, VALIDATION_CODES.ROUND_ALREADY_COMPLETE);
  if (!state.players.some(({ id }) => id === playerId)) return reject(state, VALIDATION_CODES.PLAYER_NOT_FOUND);
  if (state.currentPlayerId !== playerId) return reject(state, VALIDATION_CODES.NOT_YOUR_TURN);
  return null;
};
const finishTurn = (state, playerId) => ({
  ...state,
  currentPlayerId: advancePlayer(state, playerId),
  turnState: "normal",
  drawnCardId: null,
  revision: state.revision + 1,
});
const recycleIfNeeded = (state, random) => {
  if (state.drawPile.length || state.discardPile.length <= 1) return state;
  return {
    ...state,
    drawPile: shuffleCrazyEightsDeck(state.discardPile.slice(0, -1), random),
    discardPile: [state.discardPile.at(-1)],
  };
};

export function createCrazyEightsRound({ players, deck, random = Math.random, roundNumber = 1 }) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RangeError(`Crazy Eights requires ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }
  if (players.some((player) => !player || typeof player.id !== "string" || typeof player.name !== "string")) {
    throw new TypeError("Every player requires string id and name values.");
  }
  if (new Set(players.map(({ id }) => id)).size !== players.length) throw new Error("Player IDs must be unique.");
  const source = deck ? deck.map((card) => ({ ...card })) : shuffleCrazyEightsDeck(createCrazyEightsDeck(), random);
  validateCrazyEightsDeck(source);
  const handSize = cardsPerPlayer(players.length);
  const hands = Array.from({ length: players.length }, () => []);
  let cursor = 0;
  for (let cardIndex = 0; cardIndex < handSize; cardIndex += 1) {
    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      hands[playerIndex].push({ ...source[cursor++] });
    }
  }
  const remaining = source.slice(cursor);
  const discardIndex = remaining.findIndex(({ rank }) => rank !== "8");
  if (discardIndex < 0) throw new Error("No non-eight card is available for the initial discard.");
  const [initialDiscard] = remaining.splice(discardIndex, 1);
  return {
    gameId: GAME_ID,
    phase: "playing",
    roundNumber,
    players: players.map(({ id, name }, index) => ({ id, name, hand: hands[index] })),
    drawPile: remaining,
    discardPile: [{ ...initialDiscard }],
    currentPlayerId: players[0].id,
    activeSuit: initialDiscard.suit,
    turnState: "normal",
    drawnCardId: null,
    winnerPlayerId: null,
    revision: 0,
  };
}

export function playCard(state, playerId, cardIds, { chosenSuit } = {}) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  const player = state.players.find(({ id }) => id === playerId);
  const validation = validateCardPlay({
    hand: player.hand, cardIds, topDiscard: state.discardPile.at(-1), activeSuit: state.activeSuit,
    turnState: state.turnState, drawnCardId: state.drawnCardId, chosenSuit,
  });
  if (!validation.ok) return { ...validation, state };
  const card = validation.card;
  const players = state.players.map((candidate) => candidate.id === playerId
    ? { ...candidate, hand: candidate.hand.filter(({ id }) => id !== card.id) }
    : candidate);
  const winner = players.find(({ id }) => id === playerId).hand.length === 0;
  return {
    ok: true,
    state: {
      ...state,
      phase: winner ? "complete" : "playing",
      players,
      discardPile: [...state.discardPile, { ...card }],
      currentPlayerId: winner ? null : advancePlayer(state, playerId),
      activeSuit: card.rank === "8" ? chosenSuit : card.suit,
      turnState: "normal",
      drawnCardId: null,
      winnerPlayerId: winner ? playerId : null,
      revision: state.revision + 1,
    },
  };
}

export function drawCard(state, playerId, { random = Math.random } = {}) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  if (state.turnState === "drawn-card-decision") return reject(state, VALIDATION_CODES.CANNOT_DRAW_TWICE);
  const available = recycleIfNeeded(state, random);
  if (!available.drawPile.length) return { ok: true, state: finishTurn(available, playerId), drewCard: false };
  const [drawn, ...drawPile] = available.drawPile;
  const players = available.players.map((player) => player.id === playerId
    ? { ...player, hand: [...player.hand, { ...drawn }] } : player);
  if (isCardPlayable(drawn, available.discardPile.at(-1), available.activeSuit)) {
    return {
      ok: true,
      state: {
        ...available, players, drawPile, turnState: "drawn-card-decision",
        drawnCardId: drawn.id, revision: state.revision + 1,
      },
      drewCard: true,
    };
  }
  return { ok: true, state: finishTurn({ ...available, players, drawPile }, playerId), drewCard: true };
}

export function keepDrawnCard(state, playerId) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  if (state.turnState !== "drawn-card-decision" || !state.drawnCardId) {
    return reject(state, VALIDATION_CODES.NO_DRAWN_CARD_DECISION);
  }
  return { ok: true, state: finishTurn(state, playerId) };
}

export function timeoutTurn(state, playerId, { random = Math.random } = {}) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  if (state.turnState === "drawn-card-decision") return { ok: true, state: finishTurn(state, playerId) };
  const available = recycleIfNeeded(state, random);
  if (!available.drawPile.length) return { ok: true, state: finishTurn(available, playerId), drewCard: false };
  const [drawn, ...drawPile] = available.drawPile;
  const players = available.players.map((player) => player.id === playerId
    ? { ...player, hand: [...player.hand, { ...drawn }] } : player);
  return { ok: true, state: finishTurn({ ...available, players, drawPile }, playerId), drewCard: true };
}
