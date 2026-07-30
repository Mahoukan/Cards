import { getCardAssetUrl } from "./cardAssets.js";

const SUITS = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

export const cardLabel = (card) => {
  if (card?.isJoker === true && (card.color === "black" || card.color === "red")) {
    return `${card.color[0].toUpperCase()}${card.color.slice(1)} Joker`;
  }
  const rank = typeof card?.rank === "string" && card.rank ? card.rank : "Unknown rank";
  const suit = typeof card?.suit === "string" && card.suit ? card.suit : "unknown suit";
  return `${rank} of ${suit}`;
};

export const createCardElement = (
  card,
  { selectable = false, selected = false, stackIndex = null } = {},
) => {
  const element = document.createElement(selectable ? "button" : "div");
  element.className = "playing-card";
  if (stackIndex !== null) {
    element.style.setProperty("--card-stack-index", String(stackIndex));
  }
  if (typeof card?.id === "string") element.dataset.cardId = card.id;
  if (typeof card?.suit === "string") element.dataset.suit = card.suit;
  element.setAttribute("aria-label", `${cardLabel(card)}${selected ? ", selected" : ""}`);
  if (selectable) {
    element.type = "button";
    element.setAttribute("aria-pressed", String(selected));
  }
  element.classList.toggle("is-selected", selected);

  const fallback = document.createElement("span");
  fallback.className = "playing-card__fallback";
  fallback.setAttribute("aria-hidden", "true");
  const rank = document.createElement("span");
  rank.className = "card-rank"; rank.textContent = card?.isJoker ? "JOKER" : card?.rank ?? "?";
  const suitSymbol = document.createElement("span");
  suitSymbol.className = "card-suit"; suitSymbol.textContent = card?.isJoker ? "★" : SUITS[card?.suit] ?? "?";
  const suitName = document.createElement("span");
  suitName.className = "card-name"; suitName.textContent = card?.isJoker ? card.color : card?.suit ?? "unknown";
  fallback.append(rank, suitSymbol, suitName);
  element.append(fallback);

  const assetUrl = getCardAssetUrl(card);
  if (assetUrl) {
    const image = document.createElement("img");
    image.className = "playing-card__image";
    image.alt = "";
    image.draggable = false;
    image.addEventListener("load", () => element.classList.add("has-card-image"), { once: true });
    image.addEventListener("error", () => {
      image.hidden = true;
      element.classList.remove("has-card-image");
      element.classList.add("has-card-image-error");
    }, { once: true });
    image.src = assetUrl;
    element.prepend(image);
  }
  return element;
};
