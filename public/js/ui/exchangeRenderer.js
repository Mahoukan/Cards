import { createCardElement } from "./cardRenderer.js";
import { calculateHandLayout } from "./handLayout.js";
import { toggleCardSelection } from "./selection.js";

const formatCount = (count) => `${count} card${count === 1 ? "" : "s"}`;

export const createExchangeRenderer = ({ onReturnCards, onKick, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let view = null; let selectedIds = []; let connected = true; let busy = false; let resizeFrame = null;

  const layoutHand = () => {
    const hand = byId("exchange-hand");
    const width = Number.parseFloat(getComputedStyle(hand).getPropertyValue("--card-width")) || 72;
    const layout = calculateHandLayout({ containerWidth: hand.clientWidth, cardWidth: width, cardCount: view?.you?.hand.length ?? 0, minimumVisible: 30, gap: 6 });
    hand.style.setProperty("--card-step", `${layout.step}px`);
    hand.style.setProperty("--hand-width", `${layout.contentWidth}px`);
    hand.classList.toggle("is-scrollable", layout.scroll);
  };
  const requiredCount = () => view?.yourExchange?.type === "return_cards" ? view.yourExchange.requiredCardCount : 0;
  const canReturn = () => connected && !busy && view?.roomStatus === "exchange" && requiredCount() > 0;
  const render = () => {
    if (!view?.you) return;
    const owned = new Set(view.you.hand.map(({ id }) => id));
    selectedIds = selectedIds.filter((id) => owned.has(id));
    document.querySelectorAll("[data-room-code]").forEach((node) => { node.textContent = view.roomCode; });
    byId("exchange-round").textContent = `Round ${view.roundNumber} Exchange`;
    byId("exchange-role").textContent = view.you.role;
    const required = requiredCount();
    byId("exchange-instructions").textContent = !connected ? "Reconnecting..."
      : required ? `Return ${formatCount(required)} to ${view.yourExchange.otherPlayerName}. Mixed ranks are allowed.`
      : view.yourExchange?.type === "waiting_for_return" && !view.yourExchange.complete ? `Waiting for ${view.yourExchange.otherPlayerName} to return cards.`
      : "Waiting for every required exchange to finish.";
    byId("exchange-received").replaceChildren(...(view.yourExchange?.receivedCards ?? []).map((card) => createCardElement(card)));
    byId("exchange-given").replaceChildren(...(view.yourExchange?.givenCards ?? []).map((card) => createCardElement(card)));
    byId("exchange-players").replaceChildren(...view.players.filter(({ id }) => id !== view.you.id).map((player) => {
      const item = document.createElement("article");
      item.className = `opponent${!player.connected ? " is-offline" : ""}`;
      item.innerHTML = `<strong></strong><span></span><small></small>`;
      item.querySelector("strong").textContent = player.name;
      item.querySelector("span").textContent = player.role;
      item.querySelector("small").textContent = [player.exchangeStatus.replace("_", " "), player.isHost ? "Host" : "", !player.connected ? "Disconnected" : ""].filter(Boolean).join(" - ");
      if (view.you.isHost) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "opponent-remove"; remove.textContent = "Remove";
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick(player.id));
        item.append(remove);
      }
      return item;
    }));
    byId("exchange-hand").replaceChildren(...view.you.hand.map((card) => {
      const element = createCardElement(card, { selectable: canReturn(), selected: selectedIds.includes(card.id) });
      element.disabled = !canReturn();
      element.addEventListener("click", () => {
        const result = toggleCardSelection(selectedIds, card, view.you.hand, { mode: "exchange", max: required });
        selectedIds = result.ids; byId("exchange-notice").textContent = result.reason; render();
      });
      return element;
    }));
    byId("exchange-hand-count").textContent = formatCount(view.you.hand.length);
    const button = byId("exchange-return-button");
    button.hidden = required === 0;
    button.textContent = required ? `Return ${required}` : "Return";
    button.disabled = !canReturn() || selectedIds.length !== required;
    requestAnimationFrame(layoutHand);
  };

  byId("exchange-return-button").addEventListener("click", async () => {
    const required = requiredCount();
    if (busy || selectedIds.length !== required) return;
    busy = true; render();
    const response = await onReturnCards([...selectedIds]);
    busy = false;
    if (response.ok) { selectedIds = []; byId("exchange-notice").textContent = "Cards returned."; }
    else byId("exchange-notice").textContent = response.error?.message ?? "Those cards were rejected.";
    render();
  });
  byId("exchange-leave-button").addEventListener("click", () => onLeave(false));
  window.addEventListener("resize", () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layoutHand);
  });

  return {
    update(nextView) { view = nextView; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
    clearSelection() { selectedIds = []; render(); },
  };
};
