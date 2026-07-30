import { sortHand } from "./deck.js";
import { DECK_SIZE } from "./constants.js";
import { getExchangeRequirements, selectHighestCards } from "./roles.js";

export const EXCHANGE_ERRORS = Object.freeze({
  NOT_IN_EXCHANGE: "NOT_IN_EXCHANGE",
  NO_EXCHANGE_REQUIRED: "NO_EXCHANGE_REQUIRED",
  EXCHANGE_ALREADY_COMPLETE: "EXCHANGE_ALREADY_COMPLETE",
  WRONG_RETURN_CARD_COUNT: "WRONG_RETURN_CARD_COUNT",
  DUPLICATE_CARD: "DUPLICATE_CARD",
  CARD_NOT_OWNED: "CARD_NOT_OWNED",
  INVALID_CARD_SELECTION: "INVALID_CARD_SELECTION",
});

const messages = Object.freeze({
  [EXCHANGE_ERRORS.NOT_IN_EXCHANGE]: "This room is not exchanging cards.",
  [EXCHANGE_ERRORS.NO_EXCHANGE_REQUIRED]: "You do not have cards to return.",
  [EXCHANGE_ERRORS.EXCHANGE_ALREADY_COMPLETE]: "That exchange is already complete.",
  [EXCHANGE_ERRORS.WRONG_RETURN_CARD_COUNT]: "Choose the exact number of cards to return.",
  [EXCHANGE_ERRORS.DUPLICATE_CARD]: "Choose each card only once.",
  [EXCHANGE_ERRORS.CARD_NOT_OWNED]: "Choose cards from your hand.",
  [EXCHANGE_ERRORS.INVALID_CARD_SELECTION]: "Choose valid card IDs.",
});

const failure = (code) => ({ ok: false, error: { code, message: messages[code] } });
const cloneCard = (card) => ({ ...card });
const findHand = (state, playerId) => state.players.find((player) => player.id === playerId)?.hand;
const removeCards = (hand, cardIds) => {
  const ids = new Set(cardIds);
  return hand.filter((card) => !ids.has(card.id)).map(cloneCard);
};
const addCards = (hand, cards) => sortHand([...hand.map(cloneCard), ...cards.map(cloneCard)]);

export function assertUniqueRoundCards(state) {
  const cards = state.players.flatMap((player) => player.hand);
  const ids = cards.map((card) => card.id);
  if (cards.length !== DECK_SIZE || new Set(ids).size !== DECK_SIZE) {
    throw new Error(`Prepared round must contain exactly ${DECK_SIZE} unique cards.`);
  }
  return true;
}

export function createExchangeSession({
  roundState,
  roles,
  filteredFinishOrder,
  participants,
  nextStartingPlayerId,
  revision = 1,
  createdAt = Date.now(),
}) {
  const requirements = getExchangeRequirements(filteredFinishOrder).map((requirement) => {
    const lowerHand = findHand(roundState, requirement.lowerPlayerId);
    const givenCards = selectHighestCards(lowerHand, requirement.requiredHighestCardCount);
    return {
      ...requirement,
      givenCardIds: givenCards.map((card) => card.id),
      givenCards: givenCards.map(cloneCard),
      returnedCardIds: [],
      complete: false,
    };
  });

  let state = {
    ...roundState,
    players: roundState.players.map((player) => ({ ...player, hand: player.hand.map(cloneCard) })),
    currentPlayerId: nextStartingPlayerId,
    openingPlayRequired: false,
  };

  requirements.forEach((requirement) => {
    const lowerHand = findHand(state, requirement.lowerPlayerId);
    const givenCards = requirement.givenCardIds.map((id) => lowerHand.find((card) => card.id === id));
    state = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === requirement.lowerPlayerId) {
          return { ...player, hand: removeCards(player.hand, requirement.givenCardIds) };
        }
        if (player.id === requirement.higherPlayerId) {
          return { ...player, hand: addCards(player.hand, givenCards) };
        }
        return { ...player, hand: player.hand.map(cloneCard) };
      }),
    };
  });

  assertUniqueRoundCards(state);
  return {
    roundState: state,
    roles,
    requirements,
    participants,
    nextStartingPlayerId,
    revision,
    createdAt,
    allComplete: requirements.length === 0,
  };
}

export function returnExchangeCards(session, playerId, cardIds) {
  if (!session) return failure(EXCHANGE_ERRORS.NOT_IN_EXCHANGE);
  if (!Array.isArray(cardIds) || cardIds.some((id) => typeof id !== "string" || !id)) {
    return failure(EXCHANGE_ERRORS.INVALID_CARD_SELECTION);
  }
  if (new Set(cardIds).size !== cardIds.length) return failure(EXCHANGE_ERRORS.DUPLICATE_CARD);

  const requirement = session.requirements.find((item) => item.higherPlayerId === playerId);
  if (!requirement) return failure(EXCHANGE_ERRORS.NO_EXCHANGE_REQUIRED);
  if (requirement.complete) return failure(EXCHANGE_ERRORS.EXCHANGE_ALREADY_COMPLETE);
  if (cardIds.length !== requirement.returnCardCount) return failure(EXCHANGE_ERRORS.WRONG_RETURN_CARD_COUNT);

  const higherHand = findHand(session.roundState, requirement.higherPlayerId);
  const lowerHand = findHand(session.roundState, requirement.lowerPlayerId);
  const selectedCards = cardIds.map((id) => higherHand.find((card) => card.id === id));
  if (selectedCards.some((card) => !card)) return failure(EXCHANGE_ERRORS.CARD_NOT_OWNED);

  const roundState = {
    ...session.roundState,
    players: session.roundState.players.map((player) => {
      if (player.id === requirement.higherPlayerId) {
        return { ...player, hand: removeCards(player.hand, cardIds) };
      }
      if (player.id === requirement.lowerPlayerId) {
        return { ...player, hand: addCards(lowerHand, selectedCards) };
      }
      return { ...player, hand: player.hand.map(cloneCard) };
    }),
  };

  const requirements = session.requirements.map((item) =>
    item === requirement
      ? { ...item, returnedCardIds: [...cardIds], complete: true }
      : { ...item, returnedCardIds: [...item.returnedCardIds], givenCardIds: [...item.givenCardIds], givenCards: item.givenCards.map(cloneCard) });
  assertUniqueRoundCards(roundState);
  return {
    ok: true,
    session: {
      ...session,
      roundState,
      requirements,
      revision: session.revision + 1,
      allComplete: requirements.every((item) => item.complete),
    },
  };
}
