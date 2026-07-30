import { createCardElement } from "./cardRenderer.js";
import { calculateHandLayout, getCardStackIndex } from "./handLayout.js";
import { toggleCardSelection } from "./selection.js";
import { canCallConsecutive, reconcileSpecialSelection, selectionNeedsDirection } from "./specialRules.js";

const formatCount = (count) => `${count} card${count === 1 ? "" : "s"}`;

export const createGameRenderer = ({ onPlay, onPass, onKick, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let view = null; let selectedIds = []; let connected = true; let busy = false;
  let direction = null; let consecutive = false;
  let timerId = null; let clockOffset = 0; let resizeFrame = null;
  let announcedTurn = null; let warnedDeadline = null;

  const layoutHand = () => {
    const hand = byId("hand");
    const width = Number.parseFloat(getComputedStyle(hand).getPropertyValue("--card-width")) || 72;
    const layout = calculateHandLayout({ containerWidth: hand.clientWidth, cardWidth: width, cardCount: view?.you?.hand.length ?? 0, minimumVisible: 30, gap: 6 });
    hand.style.setProperty("--card-step", `${layout.step}px`);
    hand.style.setProperty("--hand-width", `${layout.contentWidth}px`);
    hand.classList.toggle("is-scrollable", layout.scroll);
  };
  const canAct = () => connected && !busy && view?.roomStatus === "playing" && view.currentPlayerId === view.you?.id &&
    !view.you.passed && !view.you.finished && !view.you.forfeited;
  const renderTimer = () => {
    if (!view?.turnDeadline) return;
    const estimatedServerTime = Date.now() - clockOffset;
    const seconds = Math.max(0, Math.min(30, Math.ceil((view.turnDeadline - estimatedServerTime) / 1000)));
    byId("timer-value").textContent = `0:${String(seconds).padStart(2, "0")}`;
    byId("timer-bar").style.width = `${seconds / 30 * 100}%`;
    byId("turn-panel").classList.toggle("is-urgent", seconds <= 5);
    if (seconds <= 5 && view.turnDeadline !== warnedDeadline) {
      warnedDeadline = view.turnDeadline;
      byId("game-announcement").textContent = "Five seconds remain in this turn.";
    }
  };
  const render = () => {
    if (!view?.you) return;
    const owned = new Set(view.you.hand.map(({ id }) => id));
    selectedIds = selectedIds.filter((id) => owned.has(id));
    ({ direction, consecutive } = reconcileSpecialSelection({
      selectedIds, hand: view.you.hand, direction, consecutive, view,
    }));
    document.querySelectorAll("[data-room-code]").forEach((node) => { node.textContent = view.roomCode; });
    document.querySelector(".round-label").textContent = `Round ${view.roundNumber}`;
    const opponents = view.players.filter(({ id }) => id !== view.you.id);
    byId("opponents").replaceChildren(...opponents.map((player) => {
      const item = document.createElement("article");
      item.className = `opponent${player.isCurrentPlayer ? " is-turn" : ""}${!player.connected ? " is-offline" : ""}`;
      const states = [player.isCurrentPlayer ? "Their turn" : "", player.passed ? "Passed" : "", player.finished ? `Finished #${player.finishPosition}` : "", player.forfeited ? "Forfeited" : "", player.isHost ? "Host" : "", !player.connected ? "Disconnected" : ""].filter(Boolean);
      item.innerHTML = `<strong></strong><span>${formatCount(player.cardCount)}</span><small></small>`;
      item.querySelector("strong").textContent = player.name;
      item.querySelector("small").textContent = states.join(" · ") || "Playing";
      if (view.you.isHost && !player.finished && !player.forfeited) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "opponent-remove"; remove.textContent = "Remove";
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick(player.id));
        item.append(remove);
      }
      return item;
    }));
    const cards = view.currentPlay?.cards ?? (view.lastAction?.type === "joker_clear" ? view.lastAction.cards : []);
    byId("pile-cards").replaceChildren(...cards.map((card) => createCardElement(card)));
    const pilePlayer = view.players.find(({ id }) => id === view.currentPlay?.playerId);
    byId("pile-summary").textContent = view.lastAction?.type === "joker_clear"
      ? "Joker clears the pile"
      : view.currentPlay
      ? `${pilePlayer?.name ?? "Player"} played ${formatCount(view.currentPlay.count)} · ${view.currentPlay.rank}s`
      : view.openingPlayRequired ? "Opening play must include 3♣" : "The pile is empty";
    if (view.lastAction?.type === "opening_timeout") {
      const timedOut = view.players.find(({ id }) => id === view.lastAction.playerId);
      byId("game-notice").textContent = `${timedOut?.name ?? "The opening player"} timed out, so 3♣ was played automatically.`;
    }
    const current = view.players.find(({ id }) => id === view.currentPlayerId);
    if (view.currentPlayerId !== announcedTurn) {
      announcedTurn = view.currentPlayerId; warnedDeadline = null;
      byId("game-announcement").textContent = view.currentPlayerId === view.you.id
        ? "Your turn has started."
        : `${current?.name ?? "Another player"}'s turn has started.`;
    }
    byId("turn-message").textContent = !connected ? "Reconnecting…"
      : view.you.finished ? `You finished #${view.you.finishPosition}`
      : view.you.forfeited ? "You forfeited"
      : view.currentPlayerId === view.you.id ? "Your turn" : `Waiting for ${current?.name ?? "another player"}`;
    byId("turn-panel").classList.toggle("is-your-turn", canAct());
    byId("hand").replaceChildren(...view.you.hand.map((card, index) => {
      const element = createCardElement(card, {
        selectable: true,
        selected: selectedIds.includes(card.id),
        stackIndex: getCardStackIndex(index),
      });
      element.disabled = !canAct();
      element.addEventListener("click", () => {
        const result = toggleCardSelection(selectedIds, card, view.you.hand);
        selectedIds = result.ids; byId("game-notice").textContent = result.reason; render();
      });
      return element;
    }));
    byId("hand-count").textContent = formatCount(view.you.hand.length);
    byId("play-button").textContent = selectedIds.length ? `Play ${selectedIds.length}` : "Play";
    const needsDirection = selectionNeedsDirection(selectedIds, view.you.hand);
    const mayCallConsecutive = canCallConsecutive(selectedIds, view.you.hand, view);
    byId("ten-direction-controls").hidden = !needsDirection;
    byId("direction-higher").setAttribute("aria-pressed", String(direction === "higher"));
    byId("direction-lower").setAttribute("aria-pressed", String(direction === "lower"));
    byId("consecutive-controls").hidden = !mayCallConsecutive;
    byId("call-consecutive").setAttribute("aria-pressed", String(consecutive));
    if (consecutive) byId("play-button").textContent = "Play and Call Consecutive";
    byId("active-rule-status").textContent = view.nextPlayOverride?.appliesToYou
      ? `${view.nextPlayOverride.direction === "lower" ? "Lower" : "Higher"} applies to your next play`
      : view.consecutiveActive ? `Consecutive: Next rank must be ${view.requiredNextRank ?? "the next rank"}` : "";
    byId("play-button").disabled = !canAct() || selectedIds.length === 0 || (needsDirection && !direction);
    byId("pass-button").disabled = !canAct() || !view.currentPlay;
    requestAnimationFrame(layoutHand);
    renderTimer();
  };

  byId("play-button").addEventListener("click", async () => {
    if (!selectedIds.length || busy) return;
    busy = true; render();
    const response = await onPlay([...selectedIds], { direction, consecutive });
    busy = false;
    if (response.ok) { selectedIds = []; direction = null; consecutive = false; byId("game-notice").textContent = "Play accepted."; }
    else byId("game-notice").textContent = response.error?.message ?? "That play was rejected.";
    render();
  });
  byId("pass-button").addEventListener("click", async () => {
    if (busy) return;
    busy = true; render();
    const response = await onPass();
    busy = false;
    byId("game-notice").textContent = response.ok ? "Pass accepted." : response.error?.message ?? "That pass was rejected.";
    render();
  });
  byId("direction-higher").addEventListener("click", () => { direction = "higher"; render(); });
  byId("direction-lower").addEventListener("click", () => { direction = "lower"; render(); });
  byId("call-consecutive").addEventListener("click", () => { consecutive = !consecutive; render(); });
  byId("game-leave-button").addEventListener("click", () => onLeave(view?.roomStatus !== "round_complete"));
  window.addEventListener("resize", () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layoutHand);
  });

  return {
    update(nextView) { view = nextView; clockOffset = Date.now() - nextView.serverTime; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
    clearSelection() { selectedIds = []; direction = null; consecutive = false; render(); },
    startTimer() { if (timerId === null) timerId = window.setInterval(renderTimer, 250); renderTimer(); },
    stopTimer() { if (timerId !== null) window.clearInterval(timerId); timerId = null; },
  };
};
