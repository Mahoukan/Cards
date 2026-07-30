import { DECK_SIZE, RANKS, SUITS } from "./constants.js";

export const createCrazyEightsDeck = () => RANKS.flatMap((rank, value) =>
  SUITS.map((suit) => ({ id: `${rank}-${suit}`, rank, suit, value })));

export const shuffleCrazyEightsDeck = (deck, random = Math.random) => {
  if (!Array.isArray(deck) || typeof random !== "function") throw new TypeError("A deck and random function are required.");
  const shuffled = deck.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("random must return a value from 0 up to 1.");
    const swap = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
};

export const validateCrazyEightsDeck = (deck) => {
  if (!Array.isArray(deck) || deck.length !== DECK_SIZE) throw new Error("Crazy Eights requires exactly 52 cards.");
  if (new Set(deck.map(({ id }) => id)).size !== DECK_SIZE) throw new Error("Crazy Eights card IDs must be unique.");
  if (deck.some((card) => !RANKS.includes(card.rank) || !SUITS.includes(card.suit) || card.id !== `${card.rank}-${card.suit}`)) {
    throw new Error("Crazy Eights requires the standard 52-card deck without jokers.");
  }
};

export const cardsPerPlayer = (playerCount) => playerCount === 2 ? 7 : 5;
