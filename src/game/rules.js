import { THREE_OF_CLUBS_ID, VALIDATION_CODES } from "./constants.js";
import { getRankValue } from "./deck.js";

const messages = Object.freeze({
  [VALIDATION_CODES.EMPTY_SELECTION]: "At least one card must be selected.",
  [VALIDATION_CODES.DUPLICATE_CARD]: "A card cannot be selected more than once.",
  [VALIDATION_CODES.CARD_NOT_OWNED]: "The player does not own every selected card.",
  [VALIDATION_CODES.MIXED_RANKS]: "All selected cards must have the same rank.",
  [VALIDATION_CODES.WRONG_CARD_COUNT]: "The play must contain the same number of cards as the active play.",
  [VALIDATION_CODES.RANK_NOT_HIGHER]: "The play must have a higher rank than the active play.",
  [VALIDATION_CODES.OPENING_MUST_INCLUDE_3_OF_CLUBS]: "The opening play must include the 3 of Clubs.",
  [VALIDATION_CODES.JOKER_MUST_BE_PLAYED_ALONE]: "A joker must be played alone.",
  [VALIDATION_CODES.JOKER_CANNOT_BE_BEATEN]: "No card can beat a joker.",
});

const invalid = (code) => ({
  ok: false,
  error: { code, message: messages[code] },
});

export function isNonEmptySelection(cards) {
  return Array.isArray(cards) && cards.length > 0;
}

export function hasUniqueCardIds(cards) {
  return new Set(cards.map((card) => card.id)).size === cards.length;
}

export function allCardsHaveSameRank(cards) {
  return cards.length > 0 && cards.every((card) => card.rank === cards[0].rank);
}

export function playerOwnsCards(hand, cards) {
  const ownedIds = new Set(hand.map((card) => card.id));
  return cards.every((card) => ownedIds.has(card.id));
}

export function describePlay(cards) {
  if (!isNonEmptySelection(cards)) {
    throw new TypeError("describePlay requires at least one card.");
  }
  if (!allCardsHaveSameRank(cards)) {
    throw new TypeError("describePlay requires cards of one rank.");
  }
  return {
    rank: cards[0].rank,
    value: getRankValue(cards[0].rank),
    count: cards.length,
    isJoker: cards[0].isJoker === true,
  };
}

export function compareRanks(leftRank, rightRank) {
  return Math.sign(getRankValue(leftRank) - getRankValue(rightRank));
}

export function validatePlay({
  hand,
  selectedCards,
  currentPlay = null,
  openingPlayRequired = false,
}) {
  if (!isNonEmptySelection(selectedCards)) {
    return invalid(VALIDATION_CODES.EMPTY_SELECTION);
  }
  if (!hasUniqueCardIds(selectedCards)) {
    return invalid(VALIDATION_CODES.DUPLICATE_CARD);
  }
  if (!playerOwnsCards(hand, selectedCards)) {
    return invalid(VALIDATION_CODES.CARD_NOT_OWNED);
  }
  const containsJoker = selectedCards.some((card) => card.isJoker === true);
  if (containsJoker && (selectedCards.length !== 1 || !selectedCards[0].isJoker)) {
    return invalid(VALIDATION_CODES.JOKER_MUST_BE_PLAYED_ALONE);
  }
  if (!allCardsHaveSameRank(selectedCards)) {
    return invalid(VALIDATION_CODES.MIXED_RANKS);
  }
  if (openingPlayRequired && !selectedCards.some((card) => card.id === THREE_OF_CLUBS_ID)) {
    return invalid(VALIDATION_CODES.OPENING_MUST_INCLUDE_3_OF_CLUBS);
  }

  const play = describePlay(selectedCards);
  if (currentPlay?.isJoker) {
    return invalid(VALIDATION_CODES.JOKER_CANNOT_BE_BEATEN);
  }
  if (play.isJoker) {
    return { ok: true, play };
  }
  if (currentPlay && play.count !== currentPlay.count) {
    return invalid(VALIDATION_CODES.WRONG_CARD_COUNT);
  }
  if (currentPlay && play.value <= currentPlay.value) {
    return invalid(VALIDATION_CODES.RANK_NOT_HIGHER);
  }
  return { ok: true, play };
}

export function playClearsPile(play) {
  return play.rank === "2" || play.isJoker === true;
}
