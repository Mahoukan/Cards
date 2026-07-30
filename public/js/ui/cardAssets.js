const STANDARD_CARD_ID = /^(?:A|2|3|4|5|6|7|8|9|10|J|Q|K)-(?:clubs|diamonds|hearts|spades)$/;
const JOKER_IDS = new Set(["joker-black", "joker-red"]);

export const isStandardCardId = (value) =>
  typeof value === "string" && STANDARD_CARD_ID.test(value);

export const isCardAssetId = (value) =>
  isStandardCardId(value) || JOKER_IDS.has(value);

export const getCardAssetUrl = (card) =>
  card && typeof card === "object" && !Array.isArray(card) && isCardAssetId(card.id)
    ? `/assets/cards/${card.id}.svg`
    : null;
