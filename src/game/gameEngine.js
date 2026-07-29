import { MAX_PLAYERS, MIN_PLAYERS, VALIDATION_CODES } from "./constants.js";
import {
  createDeck,
  dealCards,
  findThreeOfClubsHolder,
  shuffleDeck,
  sortHand,
} from "./deck.js";
import { playClearsPile, validatePlay } from "./rules.js";

const actionMessages = Object.freeze({
  [VALIDATION_CODES.NOT_YOUR_TURN]: "It is not this player's turn.",
  [VALIDATION_CODES.CANNOT_PASS_EMPTY_PILE]: "A player cannot pass when beginning a new pile.",
  [VALIDATION_CODES.PLAYER_ALREADY_FINISHED]: "This player has already finished.",
  [VALIDATION_CODES.PLAYER_NOT_FOUND]: "The player does not exist in this round.",
  [VALIDATION_CODES.ROUND_ALREADY_COMPLETE]: "The round is already complete.",
});

const reject = (state, code) => ({
  ok: false,
  error: { code, message: actionMessages[code] },
  state,
});

function validatePlayers(players) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RangeError(`A round requires ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }
  if (players.some((player) => !player || typeof player.id !== "string" || typeof player.name !== "string")) {
    throw new TypeError("Every player must have string id and name properties.");
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new Error("Player IDs must be unique.");
  }
}

function validateDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== 52) {
    throw new Error("A round deck must contain exactly 52 cards.");
  }
  if (new Set(deck.map((card) => card.id)).size !== 52) {
    throw new Error("Every card in the round deck must have a unique ID.");
  }
}

function nextEligiblePlayerId(state, afterPlayerId, excludedIds = new Set()) {
  const startIndex = state.players.findIndex((player) => player.id === afterPlayerId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(startIndex + offset) % state.players.length];
    if (player.finishPosition === null && !excludedIds.has(player.id)) {
      return player.id;
    }
  }
  return null;
}

function finishPlayer(players, playerId, position) {
  return players.map((player) =>
    player.id === playerId
      ? { ...player, finishPosition: position }
      : player,
  );
}

function completeIfOneRemains(state) {
  const unfinished = state.players.filter((player) => player.finishPosition === null);
  if (unfinished.length !== 1) {
    return state;
  }
  const finalPlayer = unfinished[0];
  const finishOrder = [...state.finishOrder, finalPlayer.id];
  return {
    ...state,
    phase: "complete",
    players: finishPlayer(state.players, finalPlayer.id, finishOrder.length),
    currentPlayerId: null,
    finishOrder,
  };
}

function clearedPileState(state, leaderId) {
  return {
    ...state,
    currentPlayerId: leaderId,
    currentPlay: null,
    passedPlayerIds: [],
    lastSuccessfulPlayerId: null,
  };
}

export function createRound({
  players,
  deck,
  roundNumber = 1,
  random = Math.random,
}) {
  validatePlayers(players);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    throw new RangeError("roundNumber must be a positive integer.");
  }

  const roundDeck = deck
    ? deck.map((card) => ({ ...card }))
    : shuffleDeck(createDeck(), random);
  validateDeck(roundDeck);
  const hands = dealCards(roundDeck, players.length);
  const roundPlayers = players.map((player, index) => ({
    id: player.id,
    name: player.name,
    hand: sortHand(hands[index]),
    finishPosition: null,
  }));
  const startingPlayerId = findThreeOfClubsHolder(roundPlayers);
  if (!startingPlayerId) {
    throw new Error("The round deck must contain the 3 of Clubs.");
  }

  return {
    phase: "playing",
    roundNumber,
    players: roundPlayers,
    currentPlayerId: startingPlayerId,
    currentPlay: null,
    discardPile: [],
    passedPlayerIds: [],
    lastSuccessfulPlayerId: null,
    finishOrder: [],
    openingPlayRequired: true,
  };
}

export function playCards(state, playerId, cardIds) {
  if (state.phase === "complete") {
    return reject(state, VALIDATION_CODES.ROUND_ALREADY_COMPLETE);
  }
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return reject(state, VALIDATION_CODES.PLAYER_NOT_FOUND);
  }
  if (player.finishPosition !== null) {
    return reject(state, VALIDATION_CODES.PLAYER_ALREADY_FINISHED);
  }
  if (state.currentPlayerId !== playerId) {
    return reject(state, VALIDATION_CODES.NOT_YOUR_TURN);
  }

  const selectedCards = cardIds.map((cardId) =>
    player.hand.find((card) => card.id === cardId) ?? { id: cardId },
  );
  const validation = validatePlay({
    hand: player.hand,
    selectedCards,
    currentPlay: state.currentPlay,
    openingPlayRequired: state.openingPlayRequired,
  });
  if (!validation.ok) {
    return { ...validation, state };
  }

  const selectedIds = new Set(cardIds);
  let players = state.players.map((candidate) =>
    candidate.id === playerId
      ? {
          ...candidate,
          hand: candidate.hand.filter((card) => !selectedIds.has(card.id)),
        }
      : candidate,
  );
  let finishOrder = [...state.finishOrder];
  const updatedPlayer = players.find((candidate) => candidate.id === playerId);
  if (updatedPlayer.hand.length === 0) {
    finishOrder.push(playerId);
    players = finishPlayer(players, playerId, finishOrder.length);
  }

  const activePlay = {
    ...validation.play,
    playerId,
    cards: selectedCards.map((card) => ({ ...card })),
  };
  let nextState = {
    ...state,
    players,
    currentPlay: activePlay,
    discardPile: [
      ...state.discardPile,
      ...selectedCards.map((card) => ({ ...card })),
    ],
    lastSuccessfulPlayerId: playerId,
    finishOrder,
    openingPlayRequired: false,
  };
  nextState = completeIfOneRemains(nextState);
  if (nextState.phase === "complete") {
    return { ok: true, state: nextState };
  }

  if (playClearsPile(validation.play)) {
    const leaderId = updatedPlayer.hand.length > 0
      ? playerId
      : nextEligiblePlayerId(nextState, playerId);
    return { ok: true, state: clearedPileState(nextState, leaderId) };
  }

  const passedIds = new Set([...nextState.passedPlayerIds, playerId]);
  const nextPlayerId = nextEligiblePlayerId(nextState, playerId, passedIds);
  if (nextPlayerId) {
    return {
      ok: true,
      state: { ...nextState, currentPlayerId: nextPlayerId },
    };
  }

  const leaderId = updatedPlayer.hand.length > 0
    ? playerId
    : nextEligiblePlayerId(nextState, playerId);
  return { ok: true, state: clearedPileState(nextState, leaderId) };
}

export function passTurn(state, playerId) {
  if (state.phase === "complete") {
    return reject(state, VALIDATION_CODES.ROUND_ALREADY_COMPLETE);
  }
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return reject(state, VALIDATION_CODES.PLAYER_NOT_FOUND);
  }
  if (player.finishPosition !== null) {
    return reject(state, VALIDATION_CODES.PLAYER_ALREADY_FINISHED);
  }
  if (state.currentPlayerId !== playerId) {
    return reject(state, VALIDATION_CODES.NOT_YOUR_TURN);
  }
  if (!state.currentPlay) {
    return reject(state, VALIDATION_CODES.CANNOT_PASS_EMPTY_PILE);
  }

  const passedPlayerIds = [...new Set([...state.passedPlayerIds, playerId])];
  const stateAfterPass = { ...state, passedPlayerIds };
  const nextPlayerId = nextEligiblePlayerId(
    stateAfterPass,
    playerId,
    new Set([...passedPlayerIds, stateAfterPass.lastSuccessfulPlayerId]),
  );
  if (nextPlayerId) {
    return {
      ok: true,
      state: { ...stateAfterPass, currentPlayerId: nextPlayerId },
    };
  }

  const lastPlayer = stateAfterPass.players.find(
    (candidate) => candidate.id === stateAfterPass.lastSuccessfulPlayerId,
  );
  const leaderId = lastPlayer?.finishPosition === null
    ? lastPlayer.id
    : nextEligiblePlayerId(stateAfterPass, stateAfterPass.lastSuccessfulPlayerId);
  return {
    ok: true,
    state: clearedPileState(stateAfterPass, leaderId),
  };
}
