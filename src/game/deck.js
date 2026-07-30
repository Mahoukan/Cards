import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  JOKER_RANK,
  JOKER_VALUE,
  RANKS,
  SUITS,
  THREE_OF_CLUBS_ID,
} from "./constants.js";

const rankValues = new Map(RANKS.map((rank, value) => [rank, value]));
const suitValues = new Map(SUITS.map((suit, value) => [suit, value]));

export function createDeck() {
  const standardCards = RANKS.flatMap((rank, value) =>
    SUITS.map((suit) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      value,
    })),
  );
  return [
    ...standardCards,
    { id: "joker-black", rank: JOKER_RANK, suit: null, color: "black", value: JOKER_VALUE, isJoker: true },
    { id: "joker-red", rank: JOKER_RANK, suit: null, color: "red", value: JOKER_VALUE, isJoker: true },
  ];
}

export function shuffleDeck(deck, random = Math.random) {
  if (!Array.isArray(deck) || typeof random !== "function") {
    throw new TypeError("shuffleDeck requires a deck array and a random function.");
  }

  const shuffled = deck.map((card) => ({ ...card }));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new RangeError("The random function must return a number from 0 up to, but not including, 1.");
    }
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function dealCards(deck, playerCount) {
  if (!Array.isArray(deck)) {
    throw new TypeError("dealCards requires a deck array.");
  }
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(`playerCount must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`);
  }

  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => {
    hands[index % playerCount].push({ ...card });
  });
  return hands;
}

export function sortHand(hand) {
  if (!Array.isArray(hand)) {
    throw new TypeError("sortHand requires a hand array.");
  }

  return hand
    .map((card) => ({ ...card }))
    .sort((left, right) => {
      const rankDifference = getRankValue(left.rank) - getRankValue(right.rank);
      if (rankDifference) return rankDifference;
      if (left.isJoker || right.isJoker) {
        return (left.color === "red" ? 1 : 0) - (right.color === "red" ? 1 : 0);
      }
      return getSuitValue(left.suit) - getSuitValue(right.suit);
    });
}

export function findThreeOfClubsHolder(players) {
  if (!Array.isArray(players)) {
    throw new TypeError("findThreeOfClubsHolder requires a player array.");
  }
  return players.find((player) =>
    player.hand?.some((card) => card.id === THREE_OF_CLUBS_ID),
  )?.id ?? null;
}

export function selectHighestCards(hand, count) {
  if (!Array.isArray(hand)) {
    throw new TypeError("selectHighestCards requires a hand array.");
  }
  if (!Number.isInteger(count) || count < 0 || count > hand.length) {
    throw new RangeError("count must be a non-negative integer no greater than the hand size.");
  }
  if (count === 0) {
    return [];
  }
  return sortHand(hand).slice(-count).reverse();
}

export function getRankValue(rank) {
  if (rank === JOKER_RANK) return JOKER_VALUE;
  const value = rankValues.get(rank);
  if (value === undefined) {
    throw new RangeError(`Unknown card rank: ${rank}`);
  }
  return value;
}

export function getSuitValue(suit) {
  const value = suitValues.get(suit);
  if (value === undefined) {
    throw new RangeError(`Unknown card suit: ${suit}`);
  }
  return value;
}
