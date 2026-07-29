const SUITS = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

export const cardLabel = (card) => `${card.rank} of ${card.suit}`;

export const createCardElement = (card, { selectable = false, selected = false } = {}) => {
  const element = document.createElement(selectable ? "button" : "div");
  element.className = "playing-card";
  element.dataset.cardId = card.id;
  element.dataset.suit = card.suit;
  element.setAttribute("aria-label", `${cardLabel(card)}${selected ? ", selected" : ""}`);
  if (selectable) {
    element.type = "button";
    element.setAttribute("aria-pressed", String(selected));
  }
  element.classList.toggle("is-selected", selected);
  element.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit" aria-hidden="true">${SUITS[card.suit] ?? "?"}</span><span class="card-name">${card.suit}</span>`;
  return element;
};
