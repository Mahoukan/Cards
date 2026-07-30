import { SUITS, VALIDATION_CODES } from "./constants.js";

const MESSAGES = Object.freeze({
  [VALIDATION_CODES.CARD_NOT_OWNED]: "That card is not in the player's hand.",
  [VALIDATION_CODES.MUST_PLAY_ONE_CARD]: "Play exactly one card.",
  [VALIDATION_CODES.CARD_DOES_NOT_MATCH]: "Match the active suit or top rank, or play an 8.",
  [VALIDATION_CODES.EIGHT_REQUIRES_SUIT]: "Choose a suit when playing an 8.",
  [VALIDATION_CODES.INVALID_CHOSEN_SUIT]: "Choose clubs, diamonds, hearts, or spades.",
  [VALIDATION_CODES.MUST_PLAY_DRAWN_CARD]: "Only the card just drawn may be played now.",
});

export const invalidRule = (code) => ({ ok: false, error: { code, message: MESSAGES[code] } });

export const isCardPlayable = (card, topDiscard, activeSuit) => Boolean(
  card && topDiscard && (card.rank === "8" || card.rank === topDiscard.rank || card.suit === activeSuit),
);

export const validateCardPlay = ({ hand, cardIds, topDiscard, activeSuit, turnState, drawnCardId, chosenSuit }) => {
  if (!Array.isArray(cardIds) || cardIds.length !== 1 || typeof cardIds[0] !== "string") {
    return invalidRule(VALIDATION_CODES.MUST_PLAY_ONE_CARD);
  }
  const card = hand.find(({ id }) => id === cardIds[0]);
  if (!card) return invalidRule(VALIDATION_CODES.CARD_NOT_OWNED);
  if (turnState === "drawn-card-decision" && card.id !== drawnCardId) {
    return invalidRule(VALIDATION_CODES.MUST_PLAY_DRAWN_CARD);
  }
  if (!isCardPlayable(card, topDiscard, activeSuit)) return invalidRule(VALIDATION_CODES.CARD_DOES_NOT_MATCH);
  if (card.rank === "8") {
    if (chosenSuit === undefined) return invalidRule(VALIDATION_CODES.EIGHT_REQUIRES_SUIT);
    if (typeof chosenSuit !== "string" || !SUITS.includes(chosenSuit)) return invalidRule(VALIDATION_CODES.INVALID_CHOSEN_SUIT);
  }
  return { ok: true, card };
};
