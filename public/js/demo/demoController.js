import { createCardElement } from "../ui/cardRenderer.js";
import { calculateHandLayout } from "../ui/handLayout.js";
import { toggleCardSelection } from "../ui/selection.js";
import { results } from "./demoState.js";

export const validateDisplayName = (value, maxLength = 20) => {
  const name = String(value ?? "").trim();
  if (!name) return { valid: false, value: "", message: "Enter a display name." };
  if (name.length > maxLength) return { valid: false, value: name, message: `Use ${maxLength} characters or fewer.` };
  return { valid: true, value: name, message: "" };
};

export const normaliseRoomCode = (value, maxLength = 4) =>
  String(value ?? "").replace(/\s/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, maxLength);

export const formatCardCount = (count) => `${count} card${count === 1 ? "" : "s"}`;
export const formatTimer = (seconds) => `0:${String(Math.max(0, seconds)).padStart(2, "0")}`;

export const createDemoController = ({ state, navigate }) => {
  let timerId = null;
  let resizeFrame = null;
  const byId = (id) => document.getElementById(id);

  const renderLobby = () => {
    document.querySelectorAll("[data-room-code]").forEach((node) => { node.textContent = state.roomCode; });
    byId("player-count").textContent = `${state.players.length} / 6`;
    byId("player-list").replaceChildren(...state.players.map((player) => {
      const item = document.createElement("li");
      item.className = `player-row${player.current ? " is-you" : ""}`;
      const labels = [player.current ? "You" : "", player.host ? "Host" : "", player.connected ? "" : "Disconnected", player.ready ? "Ready" : "Not ready"].filter(Boolean);
      item.innerHTML = `<div><strong>${player.name}</strong><span>${labels.join(" · ")}</span></div>`;
      if (state.isHost && !player.current) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "remove-button"; remove.textContent = `Remove ${player.name}`;
        remove.addEventListener("click", () => { state.players = state.players.filter(({ id }) => id !== player.id); renderLobby(); });
        item.append(remove);
      }
      return item;
    }));
    const you = state.players.find(({ current }) => current);
    const ready = you?.ready ?? false;
    byId("ready-button").textContent = ready ? "Ready ✓" : "I’m Ready";
    byId("ready-button").setAttribute("aria-pressed", String(ready));
    const connected = state.players.filter(({ connected }) => connected);
    const canStart = connected.length >= 2 && connected.every(({ ready: isReady }) => isReady);
    byId("lobby-status").textContent = canStart ? "Everyone is ready. Opening the game prototype…" : "At least two connected players must be ready. The game starts automatically.";
    if (canStart) window.setTimeout(() => navigate("game"), 500);
  };

  const renderOpponents = () => {
    const opponents = state.players.filter(({ current }) => !current);
    byId("opponents").replaceChildren(...opponents.map((player) => {
      const item = document.createElement("article");
      const flags = [player.turn ? "Their turn" : "", player.passed ? "Passed" : "", player.finished ? "Finished" : "", !player.connected ? "Disconnected" : ""].filter(Boolean);
      item.className = `opponent${player.turn ? " is-turn" : ""}${!player.connected ? " is-offline" : ""}`;
      item.innerHTML = `<strong>${player.name}</strong><span>${formatCardCount(player.cards)}</span><small>${flags.join(" · ") || "Playing"}</small>`;
      return item;
    }));
  };

  const layoutHand = () => {
    const hand = byId("hand");
    const cardWidth = Number.parseFloat(getComputedStyle(hand).getPropertyValue("--card-width")) || 72;
    const layout = calculateHandLayout({ containerWidth: hand.clientWidth, cardWidth, cardCount: state.hand.length, minimumVisible: 30, gap: 6 });
    hand.style.setProperty("--card-step", `${layout.step}px`);
    hand.style.setProperty("--hand-width", `${layout.contentWidth}px`);
    hand.classList.toggle("is-scrollable", layout.scroll);
  };

  const renderGame = () => {
    renderOpponents();
    const pile = byId("pile-cards");
    pile.replaceChildren(...(state.pile.cards ?? []).map((card) => createCardElement(card)));
    byId("pile-summary").textContent = state.pile.cards?.length ? `${state.pile.player} played ${formatCardCount(state.pile.cards.length)} · ${state.pile.cards[0].rank}s` : "The pile is empty";
    const canAct = state.turnId === "you" && !state.youPassed && !state.youFinished;
    byId("turn-message").textContent = state.youFinished ? "You finished!" : state.youPassed ? "You passed" : canAct ? "Your turn" : `Waiting for ${state.players.find(({ id }) => id === state.turnId)?.name ?? "another player"}`;
    byId("turn-panel").classList.toggle("is-your-turn", canAct);
    byId("hand").replaceChildren(...state.hand.map((card) => {
      const element = createCardElement(card, { selectable: true, selected: state.selectedIds.includes(card.id) });
      element.disabled = !canAct;
      element.addEventListener("click", () => {
        const result = toggleCardSelection(state.selectedIds, card, state.hand);
        state.selectedIds = result.ids;
        byId("game-notice").textContent = result.reason;
        renderGame();
      });
      return element;
    }));
    byId("hand-count").textContent = formatCardCount(state.hand.length);
    const count = state.selectedIds.length;
    byId("play-button").textContent = count ? `Play ${count}` : "Play";
    byId("play-button").disabled = !canAct || !count;
    byId("pass-button").disabled = !canAct || !state.pile.cards?.length;
    requestAnimationFrame(layoutHand);
  };

  const advanceMockTurn = () => {
    state.turnId = "alex";
    state.seconds = 30;
    state.players.forEach((player) => { player.turn = player.id === "alex"; });
    renderGame();
    window.setTimeout(() => {
      if (document.body.dataset.screen !== "game") return;
      state.turnId = "you"; state.youPassed = false; state.seconds = 30;
      state.players.forEach((player) => { player.turn = false; });
      renderGame();
    }, 1800);
  };

  const startTimer = () => {
    stopTimer(); state.seconds = 30; updateTimer();
    timerId = window.setInterval(() => { state.seconds = state.seconds <= 1 ? 30 : state.seconds - 1; updateTimer(); }, 1000);
  };
  const updateTimer = () => {
    byId("timer-value").textContent = formatTimer(state.seconds);
    byId("timer-bar").style.width = `${state.seconds / 30 * 100}%`;
  };
  const stopTimer = () => { if (timerId !== null) window.clearInterval(timerId); timerId = null; };

  byId("ready-button").addEventListener("click", () => {
    const you = state.players.find(({ current }) => current); if (you) you.ready = !you.ready; renderLobby();
  });
  byId("copy-link").addEventListener("click", async () => {
    const message = byId("copy-message");
    try { await navigator.clipboard.writeText(`${location.origin}/?screen=join&room=${state.roomCode}`); message.textContent = "Invite link copied."; }
    catch { message.textContent = `Copy this room code: ${state.roomCode}`; }
    window.setTimeout(() => { message.textContent = ""; }, 2500);
  });
  byId("play-button").addEventListener("click", () => {
    if (!state.selectedIds.length) return;
    const played = state.hand.filter(({ id }) => state.selectedIds.includes(id));
    state.hand = state.hand.filter(({ id }) => !state.selectedIds.includes(id));
    state.selectedIds = []; state.pile = { cards: played, player: "You" };
    state.youFinished = state.hand.length === 0;
    byId("game-notice").textContent = state.youFinished ? "Hand complete. Opening results…" : "Prototype play made. No server event was sent.";
    if (state.youFinished) window.setTimeout(() => navigate("results"), 900); else advanceMockTurn();
    renderGame();
  });
  byId("pass-button").addEventListener("click", () => { state.youPassed = true; byId("game-notice").textContent = "You passed in this local prototype."; advanceMockTurn(); });
  byId("menu-button").addEventListener("click", () => byId("game-menu").showModal());
  byId("close-menu").addEventListener("click", () => byId("game-menu").close());
  byId("game-menu").addEventListener("click", (event) => { if (event.target === byId("game-menu")) byId("game-menu").close(); });
  window.addEventListener("resize", () => { if (resizeFrame) cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(layoutHand); });

  byId("results-list").replaceChildren(...results.map(([name, role], index) => {
    const item = document.createElement("li"); item.innerHTML = `<span>${index + 1}</span><strong>${name}</strong><em>${role}</em>`; return item;
  }));

  return {
    enter(screen) {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      if (screen === "lobby") renderLobby();
      if (screen === "game") { state.selectedIds = []; state.youPassed = false; renderGame(); startTimer(); }
      else stopTimer();
    },
    setIdentity(name, isHost, roomCode = "ABCD") {
      state.isHost = isHost; state.roomCode = roomCode;
      const you = state.players.find(({ current }) => current); if (you) { you.name = name; you.host = isHost; }
      renderLobby();
    },
  };
};
