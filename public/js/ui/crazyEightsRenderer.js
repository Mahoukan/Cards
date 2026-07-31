import { createCardElement } from "./cardRenderer.js";
import { calculateHandLayout, getCardStackIndex } from "./handLayout.js";

const SUITS = { clubs: "Clubs ♣", diamonds: "Diamonds ♦", hearts: "Hearts ♥", spades: "Spades ♠" };
const count = (value) => `${value} card${value === 1 ? "" : "s"}`;

export const createCrazyEightsRenderer = ({ onPlay, onDraw, onKeep, onKick, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let view = null;
  let selectedId = null;
  let chosenSuit = null;
  let busy = false;
  let connected = true;
  let timerId = null;
  let clockOffset = 0;

  const canAct = () => connected && !busy && view?.roomStatus === "playing" && view.currentPlayerId === view.you?.id;
  const selectedCard = () => view?.you?.hand.find(({ id }) => id === selectedId);
  const layout = () => {
    const hand = byId("ce-hand");
    const width = Number.parseFloat(getComputedStyle(hand).getPropertyValue("--card-width")) || 72;
    const value = calculateHandLayout({ containerWidth: hand.clientWidth, cardWidth: width, cardCount: view?.you?.hand.length ?? 0, minimumVisible: 30, gap: 6 });
    hand.style.setProperty("--card-step", `${value.step}px`);
    hand.style.setProperty("--hand-width", `${value.contentWidth}px`);
  };
  const renderTimer = () => {
    if (!view?.turnDeadline) return;
    const seconds = Math.max(0, Math.min(30, Math.ceil((view.turnDeadline - (Date.now() - clockOffset)) / 1000)));
    byId("ce-timer").textContent = `0:${String(seconds).padStart(2, "0")}`;
  };
  const render = () => {
    if (!view?.you) return;
    if (!view.you.hand.some(({ id }) => id === selectedId)) { selectedId = null; chosenSuit = null; }
    const selected = selectedCard();
    if (selected?.rank !== "8") chosenSuit = null;
    document.querySelectorAll("[data-room-code]").forEach((node) => { node.textContent = view.roomCode; });
    byId("ce-round").textContent = `Round ${view.roundNumber}`;
    byId("ce-active-suit").textContent = SUITS[view.activeSuit] ?? view.activeSuit;
    byId("ce-draw-count").textContent = count(view.drawPileCount);
    byId("ce-discard-count").textContent = count(view.discardPileCount);
    byId("ce-top-card").replaceChildren(...(view.topDiscard ? [createCardElement(view.topDiscard)] : []));
    const current = view.players.find(({ id }) => id === view.currentPlayerId);
    byId("ce-turn-message").textContent = !connected ? "Reconnecting…"
      : view.currentPlayerId === view.you.id ? "Your turn" : `Waiting for ${current?.name ?? "another player"}`;
    byId("ce-opponents").replaceChildren(...view.players.filter(({ id }) => id !== view.you.id).map((player) => {
      const item = document.createElement("article");
      item.className = `opponent${player.isCurrentPlayer ? " is-turn" : ""}${!player.connected ? " is-offline" : ""}`;
      const name = document.createElement("strong"); name.textContent = player.name;
      const cards = document.createElement("span"); cards.textContent = count(player.cardCount);
      const status = document.createElement("small");
      status.textContent = [player.isCurrentPlayer ? "Their turn" : "", player.forfeited ? "Forfeited" : "", !player.connected ? "Disconnected" : ""].filter(Boolean).join(" · ") || "Playing";
      item.append(name, cards, status);
      if (view.you.isHost && !player.forfeited) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "opponent-remove"; remove.textContent = "Remove";
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick(player.id));
        item.append(remove);
      }
      return item;
    }));
    byId("ce-hand").replaceChildren(...view.you.hand.map((card, index) => {
      const element = createCardElement(card, { selectable: true, selected: card.id === selectedId, stackIndex: getCardStackIndex(index) });
      const allowed = canAct() && card.playable;
      element.disabled = !allowed;
      element.classList.toggle("is-unplayable", !card.playable);
      element.classList.toggle("is-newly-drawn", card.newlyDrawn);
      element.addEventListener("click", () => {
        selectedId = selectedId === card.id ? null : card.id;
        chosenSuit = null;
        render();
      });
      return element;
    }));
    byId("ce-hand-count").textContent = count(view.you.hand.length);
    const decision = view.you.turnState === "drawn-card-decision";
    byId("ce-decision").hidden = !decision;
    byId("ce-suit-chooser").hidden = selected?.rank !== "8";
    document.querySelectorAll("[data-ce-suit]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.ceSuit === chosenSuit)));
    byId("ce-play").textContent = decision ? "Play Drawn Card" : "Play Card";
    byId("ce-play").disabled = !canAct() || !selected?.playable || (decision && selected.id !== view.you.drawnCardId) || (selected.rank === "8" && !chosenSuit);
    byId("ce-draw").disabled = !canAct() || !view.you.canDraw;
    byId("ce-keep").disabled = !canAct() || !view.you.canKeepDrawn;
    const actor = view.players.find(({ id }) => id === view.lastAction?.playerId)?.name ?? "A player";
    byId("ce-notice").textContent = view.lastAction?.type === "timeout"
      ? `${actor} timed out${view.lastAction.drewCard ? ", drew a card," : ""} and ended their turn.`
      : view.lastAction?.type === "forfeit" ? `${actor} left the round.`
      : view.lastAction?.type === "play" ? `${actor} played a card.`
      : view.lastAction?.type === "draw" && !view.lastAction.decision ? `${actor} drew a card and ended their turn.`
      : "";
    requestAnimationFrame(layout);
    renderTimer();
  };

  byId("ce-play").addEventListener("click", async () => {
    if (!selectedId || busy) return;
    busy = true; render();
    const response = await onPlay(selectedId, chosenSuit);
    busy = false;
    if (response.ok) { selectedId = null; chosenSuit = null; }
    else byId("ce-notice").textContent = response.error?.message ?? "That card cannot be played.";
    render();
  });
  byId("ce-draw").addEventListener("click", async () => {
    if (busy) return;
    busy = true; render(); const response = await onDraw(); busy = false;
    if (!response.ok) byId("ce-notice").textContent = response.error?.message ?? "Unable to draw.";
    render();
  });
  byId("ce-keep").addEventListener("click", async () => {
    if (busy) return;
    busy = true; render(); const response = await onKeep(); busy = false;
    if (!response.ok) byId("ce-notice").textContent = response.error?.message ?? "Unable to keep that card.";
    render();
  });
  document.querySelectorAll("[data-ce-suit]").forEach((button) => button.addEventListener("click", () => {
    chosenSuit = button.dataset.ceSuit; render();
  }));
  byId("ce-leave").addEventListener("click", () => onLeave(true));

  return {
    update(next) { view = next; clockOffset = Date.now() - next.serverTime; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
    startTimer() { if (timerId === null) timerId = window.setInterval(renderTimer, 250); renderTimer(); },
    stopTimer() { if (timerId !== null) window.clearInterval(timerId); timerId = null; },
  };
};
