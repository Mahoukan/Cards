const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const titleCase = (value) => value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getMahjongTileLabel = (tile) => {
  if (tile.faceDown) return "Face-down Mahjong tile";
  if (tile.category === "suit") return `${NUMBER_WORDS[tile.rank]} of ${titleCase(tile.suit)}`;
  if (tile.honorType === "wind") return `${titleCase(tile.wind)} Wind`;
  if (tile.honorType === "dragon") return `${titleCase(tile.dragon)} Dragon`;
  if (tile.bonusType === "flower") return `${titleCase(tile.faceId)} Flower`;
  return titleCase(tile.faceId);
};

export const createMahjongTileElement = (tile, {
  state = "normal", selected = false, disabled = false, interactive = false, stackIndex,
} = {}) => {
  const element = document.createElement(interactive ? "button" : "div");
  if (interactive) element.type = "button";
  const faceDown = state === "face-down" || tile.faceDown;
  const label = getMahjongTileLabel({ ...tile, faceDown });
  element.className = `mahjong-tile is-${state}${selected ? " is-selected" : ""}`;
  element.dataset.tileId = tile.id;
  element.dataset.faceId = faceDown ? "face-down" : tile.faceId;
  element.setAttribute("aria-label", label);
  if (stackIndex !== undefined) element.style.setProperty("--tile-stack-index", stackIndex);
  if (interactive) {
    element.disabled = disabled;
    element.setAttribute("aria-pressed", String(selected));
  }
  const fallback = document.createElement("span");
  fallback.className = "mahjong-tile__fallback";
  fallback.textContent = faceDown ? "🀫" : label;
  element.append(fallback);
  if (!faceDown && tile.assetPath) {
    const image = document.createElement("img");
    image.className = "mahjong-tile__image";
    image.src = tile.assetPath;
    image.alt = "";
    image.addEventListener("load", () => element.classList.add("has-tile-image"));
    image.addEventListener("error", () => {
      element.classList.remove("has-tile-image");
      image.remove();
    });
    element.prepend(image);
  }
  return element;
};
