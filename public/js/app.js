import { createDemoController, normaliseRoomCode, validateDisplayName } from "./demo/demoController.js";
import { createDemoState } from "./demo/demoState.js";
import { createExchangeClient } from "./network/exchangeClient.js";
import { createGameClient } from "./network/gameClient.js";
import { createCrazyEightsClient } from "./network/crazyEightsClient.js";
import { createMahjongClient } from "./network/mahjongClient.js";
import { createRoomClient } from "./network/roomClient.js";
import { clearRoomSession, readRoomSession, saveRoomSession } from "./network/sessionStorage.js";
import { createExchangeRenderer } from "./ui/exchangeRenderer.js";
import { createGameRenderer } from "./ui/gameRenderer.js";
import { createLobbyRenderer } from "./ui/lobbyRenderer.js";
import { createResultsRenderer } from "./ui/resultsRenderer.js";
import { createCrazyEightsRenderer } from "./ui/crazyEightsRenderer.js";
import { createCrazyEightsResultsRenderer } from "./ui/crazyEightsResultsRenderer.js";
import { createMahjongRenderer } from "./ui/mahjongRenderer.js";
import { createScreenManager, normaliseScreen } from "./ui/screenManager.js";
import { createInstructionsDialog, getGameInstructions } from "./games/instructions.js";
import { GAME_CATALOG, getGameById } from "./games/gameCatalog.js";
import { renderMahjongDemo } from "./demo/mahjongDemo.js";

const params = new URLSearchParams(location.search);
const demoMode = params.get("demo") === "1";
document.body.classList.toggle("demo-mode", demoMode);
const byId = (id) => document.getElementById(id);
const connectionNodes = [...document.querySelectorAll("[data-connection]")];
const setHomeMessage = (message) => { byId("home-message").textContent = message; };
const updateConnection = (label, state) => connectionNodes.forEach((node) => {
  node.textContent = label; node.dataset.state = state;
});
GAME_CATALOG.forEach((game) => {
  document.querySelectorAll(`[data-game-card="${game.id}"]`).forEach((card) => {
    card.querySelector("[data-game-name]").textContent = game.name;
    card.querySelector("[data-game-description]").textContent = game.description;
    card.querySelector("[data-game-players]").textContent = `${game.minimumPlayers}–${game.maximumPlayers} players`;
    card.querySelector("[data-game-status]").textContent = game.status === "available" ? "Available" : "In Development";
  });
});
const instructions = createInstructionsDialog({
  dialog: byId("instructions-dialog"),
  content: byId("instructions-content"),
  closeButton: byId("close-instructions"),
});

const socket = typeof window.io === "function" ? window.io() : null;
const roomClient = socket ? createRoomClient(socket) : null;
const gameClient = socket ? createGameClient(socket) : null;
const exchangeClient = socket ? createExchangeClient(socket) : null;
const crazyEightsClient = socket ? createCrazyEightsClient(socket) : null;
const mahjongClient = socket ? createMahjongClient(socket) : null;
let activeSession = demoMode ? null : readRoomSession();
let demoController;
let lobbyRenderer;
let gameRenderer;
let resultsRenderer;
let exchangeRenderer;
let crazyEightsRenderer;
let crazyEightsResultsRenderer;
let mahjongRenderer;
let resumeAttempt = 0;

const manager = createScreenManager({
  onChange: (screen) => {
    if (demoMode) demoController?.enter(screen);
    else {
      if (screen === "game") gameRenderer?.startTimer();
      else gameRenderer?.stopTimer();
      if (screen === "crazy-eights-game") crazyEightsRenderer?.startTimer();
      else crazyEightsRenderer?.stopTimer();
      if (screen === "mahjong-game") mahjongRenderer?.startTimer();
      else mahjongRenderer?.stopTimer();
      if (screen === "game") exchangeRenderer?.clearSelection();
      if (screen === "exchange") gameRenderer?.clearSelection();
      if (screen === "lobby" && (!activeSession || !roomClient?.room)) {
        setHomeMessage("Create, join, or resume a room before opening the lobby.");
        queueMicrotask(() => manager.show("home"));
      }
    }
  },
});

const returnHome = (message, { clearStored = true } = {}) => {
  if (clearStored) clearRoomSession();
  activeSession = null;
  roomClient?.clear(); gameClient?.clear(); exchangeClient?.clear(); crazyEightsClient?.clear(); mahjongClient?.clear();
  lobbyRenderer?.clear(); gameRenderer?.stopTimer(); crazyEightsRenderer?.stopTimer(); mahjongRenderer?.stopTimer();
  setHomeMessage(message); manager.show("home");
};
const handleResponseError = (response, target = "home-message") => {
  byId(target).textContent = response?.error?.message ?? "The request could not be completed.";
};

if (demoMode) {
  const state = createDemoState();
  demoController = createDemoController({ state, navigate: (screen) => manager.show(screen) });
  byId("leave-button").addEventListener("click", () => manager.show("home"));
  byId("game-leave-button").addEventListener("click", () => manager.show("home"));
  byId("results-leave-button").addEventListener("click", () => manager.show("home"));
} else if (roomClient && gameClient && exchangeClient && crazyEightsClient && mahjongClient) {
  const leaveRealRoom = async (requiresConfirmation = false) => {
    if (requiresConfirmation && !window.confirm("Leaving will forfeit this round. Continue?")) return;
    gameRenderer.setBusy(true); exchangeRenderer?.setBusy(true); resultsRenderer?.setBusy(true);
    crazyEightsRenderer?.setBusy(true); crazyEightsResultsRenderer?.setBusy(true);
    mahjongRenderer?.setBusy(true);
    const response = await roomClient.leave();
    if (response.ok) returnHome(requiresConfirmation ? "You left the room and forfeited the round." : "You left the room.");
    gameRenderer.setBusy(false); exchangeRenderer?.setBusy(false); resultsRenderer?.setBusy(false);
    crazyEightsRenderer?.setBusy(false); crazyEightsResultsRenderer?.setBusy(false);
    mahjongRenderer?.setBusy(false);
    byId(roomClient.room?.gameId === "crazy-eights" ? "ce-notice" : "game-notice").textContent =
      response.error?.message ?? "Unable to leave the room.";
  };

  gameRenderer = createGameRenderer({
    onPlay: (cardIds, options) => gameClient.play(cardIds, options),
    onPass: () => gameClient.pass(),
    onKick: async (playerId) => {
      const response = await roomClient.kick(playerId);
      if (!response.ok) byId("game-notice").textContent = response.error?.message ?? "Unable to remove that player.";
    },
    onLeave: leaveRealRoom,
  });
  crazyEightsRenderer = createCrazyEightsRenderer({
    onPlay: (cardId, chosenSuit) => crazyEightsClient.play(cardId, chosenSuit),
    onDraw: () => crazyEightsClient.draw(),
    onKeep: () => crazyEightsClient.keepDrawn(),
    onKick: (playerId) => roomClient.kick(playerId),
    onLeave: leaveRealRoom,
  });
  crazyEightsResultsRenderer = createCrazyEightsResultsRenderer({
    onReady: (ready) => roomClient.setNextRoundReady(ready),
    onKick: (playerId) => roomClient.kick(playerId),
    onLeave: leaveRealRoom,
  });
  mahjongRenderer = createMahjongRenderer({
    onDiscard: (tileId) => mahjongClient.discard(tileId),
    onClaim: (type, tileIds) => mahjongClient.claim(type, tileIds),
    onWin: () => mahjongClient.declareWin(),
    onKong: (payload) => mahjongClient.declareKong(payload),
    onReady: (ready) => roomClient.setNextRoundReady(ready),
    onLeave: () => leaveRealRoom(true),
  });
  exchangeRenderer = createExchangeRenderer({
    onReturnCards: (cardIds) => exchangeClient.returnCards(cardIds),
    onKick: async (playerId) => {
      const response = await roomClient.kick(playerId);
      if (!response.ok) byId("exchange-notice").textContent = response.error?.message ?? "Unable to remove that player.";
    },
    onLeave: leaveRealRoom,
  });
  resultsRenderer = createResultsRenderer({
    onReady: (ready) => roomClient.setNextRoundReady(ready),
    onKick: async (playerId) => {
      const response = await roomClient.kick(playerId);
      if (!response.ok) byId("results-notice").textContent = response.error?.message ?? "Unable to remove that player.";
    },
  });
  byId("results-leave-button").addEventListener("click", () => leaveRealRoom(false));

  lobbyRenderer = createLobbyRenderer({
    onReady: async (ready) => {
      lobbyRenderer.setBusy(true);
      const response = await roomClient.setReady(ready);
      lobbyRenderer.setBusy(false);
      if (response.ok && response.room.status === "lobby") lobbyRenderer.update(response.room, activeSession.playerId);
      else if (!response.ok) handleResponseError(response, "lobby-status");
    },
    onKick: async (playerId) => {
      lobbyRenderer.setBusy(true);
      const response = await roomClient.kick(playerId);
      lobbyRenderer.setBusy(false);
      if (response.ok) lobbyRenderer.update(response.room, activeSession.playerId);
      else handleResponseError(response, "lobby-status");
    },
    onLeave: async () => {
      lobbyRenderer.setBusy(true);
      const response = await roomClient.leave();
      if (response.ok) returnHome("You left the room.");
      lobbyRenderer.setBusy(false); handleResponseError(response, "lobby-status");
    },
  });

  roomClient.on("update", (room) => {
    if (!activeSession || room.code !== activeSession.roomCode) return;
    if (room.status === "lobby") lobbyRenderer.update(room, activeSession.playerId);
    if (room.status === "round_complete") {
      if (room.gameId === "crazy-eights") crazyEightsResultsRenderer.updateRoom(room);
      else if (room.gameId !== "mahjong") resultsRenderer.updateRoom(room);
    }
  });
  roomClient.on("ready", (room) => {
    if (activeSession && room.status === "lobby") lobbyRenderer.update(room, activeSession.playerId);
  });
  roomClient.on("disconnect", () => {
    resumeAttempt += 1;
    crazyEightsRenderer.setConnected(false); crazyEightsResultsRenderer.setConnected(false);
    mahjongRenderer.setConnected(false);
    updateConnection("Reconnecting…", "reconnecting");
    lobbyRenderer.setConnected(false); gameRenderer.setConnected(false); exchangeRenderer.setConnected(false); resultsRenderer.setConnected(false);
  });
  roomClient.on("connect", async () => {
    if (!activeSession) {
      crazyEightsRenderer.setConnected(true); crazyEightsResultsRenderer.setConnected(true);
      mahjongRenderer.setConnected(true);
      updateConnection("Connected", "connected");
      lobbyRenderer.setConnected(true); gameRenderer.setConnected(true); exchangeRenderer.setConnected(true); resultsRenderer.setConnected(true);
      return;
    }
    const attempt = ++resumeAttempt;
    crazyEightsRenderer.setConnected(false); crazyEightsResultsRenderer.setConnected(false);
    mahjongRenderer.setConnected(false);
    updateConnection("Restoring session…", "resuming");
    lobbyRenderer.setConnected(false); gameRenderer.setConnected(false); exchangeRenderer.setConnected(false); resultsRenderer.setConnected(false);
    const response = await roomClient.resume(activeSession);
    if (attempt !== resumeAttempt) return;
    if (!response.ok) {
      if (response.error?.code === "OFFLINE" || response.error?.code === "ACK_TIMEOUT") {
        updateConnection("Reconnecting…", "reconnecting");
        return;
      }
      returnHome("Your saved room session has expired. Please create or join again.");
      return;
    }
    activeSession = response.session; saveRoomSession(activeSession);
    crazyEightsRenderer.setConnected(true); crazyEightsResultsRenderer.setConnected(true);
    mahjongRenderer.setConnected(true);
    updateConnection("Connected", "connected");
    lobbyRenderer.setConnected(true); gameRenderer.setConnected(true); exchangeRenderer.setConnected(true); resultsRenderer.setConnected(true);
    if (response.game) gameClient.accept(response.game);
    if (response.exchange) exchangeClient.accept(response.exchange);
    if (response.crazyEights) crazyEightsClient.accept(response.crazyEights);
    if (response.mahjong) mahjongClient.accept(response.mahjong);
    if (response.room.status === "lobby") {
      lobbyRenderer.update(response.room, activeSession.playerId); manager.show("lobby");
    } else if (response.room.status === "playing") manager.show(response.room.gameId === "crazy-eights" ? "crazy-eights-game" : response.room.gameId === "mahjong" ? "mahjong-game" : "game");
    else if (response.room.status === "exchange") manager.show("exchange");
    else if (response.room.status === "round_complete") manager.show(response.room.gameId === "crazy-eights" ? "crazy-eights-results" : response.room.gameId === "mahjong" ? "mahjong-game" : "results");
  });
  roomClient.on("kicked", () => returnHome("The host removed you from the room."));
  roomClient.on("replaced", () => returnHome("This room was opened in another tab.", { clearStored: false }));
  gameClient.onUpdate((view) => {
    if (!activeSession || view.roomCode !== activeSession.roomCode) return;
    gameRenderer.update(view);
    if (view.roomStatus === "round_complete") {
      resultsRenderer.update(view, roomClient.room); manager.show("results");
    } else manager.show("game");
  });
  exchangeClient.onUpdate((view) => {
    if (!activeSession || view.roomCode !== activeSession.roomCode) return;
    exchangeRenderer.update(view);
    manager.show("exchange");
  });
  crazyEightsClient.onUpdate((view) => {
    if (!activeSession || view.roomCode !== activeSession.roomCode) return;
    crazyEightsRenderer.update(view);
    if (view.roomStatus === "round_complete") {
      crazyEightsResultsRenderer.update(view, roomClient.room);
      manager.show("crazy-eights-results");
    } else manager.show("crazy-eights-game");
  });
  mahjongClient.onUpdate((view) => {
    if (!activeSession || view.roomCode !== activeSession.roomCode) return;
    mahjongRenderer.update(view);
    manager.show("mahjong-game");
  });
  socket.on("connect_error", () => updateConnection(navigator.onLine ? "Reconnecting…" : "Offline", navigator.onLine ? "reconnecting" : "offline"));
} else updateConnection("Disconnected", "disconnected");

document.addEventListener("click", (event) => {
  const instructionsButton = event.target.closest("[data-instructions]");
  if (instructionsButton) {
    const trigger = byId("game-menu").open ? byId("menu-button") : instructionsButton;
    if (byId("game-menu").open) byId("game-menu").close();
    instructions.open(instructionsButton.dataset.instructions, trigger);
    return;
  }
  const link = event.target.closest("[data-go]");
  if (!link) return;
  if (!demoMode && ["game", "exchange", "results", "lobby", "crazy-eights-game", "crazy-eights-results", "mahjong-game"].includes(link.dataset.go)) return;
  manager.show(link.dataset.go);
});

const createForm = byId("create-form");
const joinForm = byId("join-form");
const selectedGameInput = () => createForm.querySelector('input[name="gameId"]:checked');
const syncSelectedGame = () => {
  const game = getGameById(selectedGameInput()?.value);
  if (!game) return false;
  const rulesButton = byId("create-how-to-play");
  rulesButton.dataset.instructions = game.instructionsId;
  rulesButton.textContent = `How to Play ${game.name}`;
  return game.status === "available";
};
const syncFormValidity = (form, mode) => {
  const data = new FormData(form);
  const name = validateDisplayName(data.get("displayName"));
  const validGame = mode !== "create" || syncSelectedGame();
  const validCode = mode !== "join" || normaliseRoomCode(data.get("roomCode")).length === 4;
  const pending = form.dataset.pending === "true";
  form.querySelector("[type=submit]").disabled = pending || !name.valid || !validGame || !validCode;
  return name.valid && validGame && validCode;
};

const bindForm = (formId, errorId, mode) => {
  const form = byId(formId);
  form.addEventListener("input", () => syncFormValidity(form, mode));
  form.addEventListener("change", () => syncFormValidity(form, mode));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.pending === "true") return;
    const submit = form.querySelector("[type=submit]");
    const data = new FormData(form);
    const name = validateDisplayName(data.get("displayName"));
    const code = mode === "join" ? normaliseRoomCode(data.get("roomCode")) : "ABCD";
    const error = byId(errorId);
    if (!name.valid) { error.textContent = name.message; return; }
    if (mode === "join" && code.length !== 4) { error.textContent = "Enter a four-character room code."; return; }
    const game = mode === "create" ? getGameById(data.get("gameId")) : null;
    if (mode === "create" && (!game || game.status !== "available")) {
      error.textContent = "Choose an available game.";
      syncFormValidity(form, mode);
      return;
    }
    if (demoMode) {
      demoController.setIdentity(name.value, mode === "create", code); manager.show("lobby"); return;
    }
    if (!roomClient?.connected) { error.textContent = "Connect to the server before using room controls."; return; }
    error.textContent = ""; form.dataset.pending = "true"; form.setAttribute("aria-busy", "true");
    submit.disabled = true; submit.textContent = mode === "create" ? "Creating…" : "Joining…";
    const response = mode === "create" ? await roomClient.create(name.value, game.id) : await roomClient.join(name.value, code);
    form.dataset.pending = "false"; form.removeAttribute("aria-busy");
    submit.textContent = mode === "create" ? "Create Room" : "Join Room";
    syncFormValidity(form, mode);
    if (!response.ok) { handleResponseError(response, errorId); return; }
    activeSession = response.session; saveRoomSession(activeSession);
    lobbyRenderer.update(response.room, activeSession.playerId); manager.show("lobby");
  });
};
bindForm("create-form", "create-error", "create");
bindForm("join-form", "join-error", "join");
syncFormValidity(createForm, "create");
syncFormValidity(joinForm, "join");

if (!demoMode) {
  byId("copy-link").addEventListener("click", async () => {
    const message = byId("copy-message");
    const link = `${location.origin}${location.pathname}?room=${activeSession?.roomCode}`;
    try { await navigator.clipboard.writeText(link); message.textContent = "Invite link copied."; }
    catch { message.textContent = `Share this link: ${link}`; }
    window.setTimeout(() => { message.textContent = ""; }, 3000);
  });
}

const roomInput = byId("room-code");
roomInput.addEventListener("input", () => {
  roomInput.value = normaliseRoomCode(roomInput.value);
  syncFormValidity(joinForm, "join");
});
const gameMenu = byId("game-menu");
byId("menu-button").addEventListener("click", () => {
  if (!gameMenu.open) gameMenu.showModal();
});
byId("close-menu").addEventListener("click", () => gameMenu.close());
gameMenu.addEventListener("click", (event) => {
  if (event.target === gameMenu) gameMenu.close();
});
window.addEventListener("popstate", () => manager.show(new URLSearchParams(location.search).get("screen"), { updateHistory: false }));
const sharedCode = normaliseRoomCode(params.get("room"));
const requestedInstructions = params.get("instructions");
if (sharedCode && !demoMode) {
  roomInput.value = sharedCode; syncFormValidity(joinForm, "join"); manager.show("join-game", { updateHistory: false });
} else {
  let initial = normaliseScreen(params.get("screen"));
  if (demoMode && params.get("game") === "mahjong" && params.get("screen") === "game") initial = "mahjong-game";
  if (!demoMode && ["game", "exchange", "results", "lobby", "crazy-eights-game", "crazy-eights-results", "mahjong-game"].includes(initial)) initial = "home";
  manager.show(initial, { updateHistory: false });
}
if (demoMode && params.get("game") === "mahjong") renderMahjongDemo();
if (getGameInstructions(requestedInstructions)) {
  queueMicrotask(() => instructions.open(requestedInstructions, document.querySelector("section[data-screen]:not([hidden]) button")));
}
