import { createDemoController, normaliseRoomCode, validateDisplayName } from "./demo/demoController.js";
import { createDemoState } from "./demo/demoState.js";
import { createExchangeClient } from "./network/exchangeClient.js";
import { createGameClient } from "./network/gameClient.js";
import { createRoomClient } from "./network/roomClient.js";
import { clearRoomSession, readRoomSession, saveRoomSession } from "./network/sessionStorage.js";
import { createExchangeRenderer } from "./ui/exchangeRenderer.js";
import { createGameRenderer } from "./ui/gameRenderer.js";
import { createLobbyRenderer } from "./ui/lobbyRenderer.js";
import { createResultsRenderer } from "./ui/resultsRenderer.js";
import { createScreenManager, normaliseScreen } from "./ui/screenManager.js";

const params = new URLSearchParams(location.search);
const demoMode = params.get("demo") === "1";
document.body.classList.toggle("demo-mode", demoMode);
const byId = (id) => document.getElementById(id);
const connectionNodes = [...document.querySelectorAll("[data-connection]")];
const setHomeMessage = (message) => { byId("home-message").textContent = message; };
const updateConnection = (label, state) => connectionNodes.forEach((node) => {
  node.textContent = label; node.dataset.state = state;
});

const socket = typeof window.io === "function" ? window.io() : null;
const roomClient = socket ? createRoomClient(socket) : null;
const gameClient = socket ? createGameClient(socket) : null;
const exchangeClient = socket ? createExchangeClient(socket) : null;
let activeSession = demoMode ? null : readRoomSession();
let demoController;
let lobbyRenderer;
let gameRenderer;
let resultsRenderer;
let exchangeRenderer;
let resumeAttempt = 0;

const manager = createScreenManager({
  onChange: (screen) => {
    if (demoMode) demoController?.enter(screen);
    else {
      if (screen === "game") gameRenderer?.startTimer();
      else gameRenderer?.stopTimer();
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
  roomClient?.clear(); gameClient?.clear(); exchangeClient?.clear(); lobbyRenderer?.clear(); gameRenderer?.stopTimer();
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
} else if (roomClient && gameClient && exchangeClient) {
  const leaveRealRoom = async (requiresConfirmation = false) => {
    if (requiresConfirmation && !window.confirm("Leaving will forfeit this round. Continue?")) return;
    gameRenderer.setBusy(true); exchangeRenderer?.setBusy(true); resultsRenderer?.setBusy(true);
    const response = await roomClient.leave();
    if (response.ok) returnHome(requiresConfirmation ? "You left the room and forfeited the round." : "You left the room.");
    gameRenderer.setBusy(false); exchangeRenderer?.setBusy(false); resultsRenderer?.setBusy(false);
    byId("game-notice").textContent = response.error?.message ?? "Unable to leave the room.";
  };

  gameRenderer = createGameRenderer({
    onPlay: (cardIds) => gameClient.play(cardIds),
    onPass: () => gameClient.pass(),
    onKick: async (playerId) => {
      const response = await roomClient.kick(playerId);
      if (!response.ok) byId("game-notice").textContent = response.error?.message ?? "Unable to remove that player.";
    },
    onLeave: leaveRealRoom,
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
    if (room.status === "round_complete") resultsRenderer.updateRoom(room);
  });
  roomClient.on("ready", (room) => {
    if (activeSession && room.status === "lobby") lobbyRenderer.update(room, activeSession.playerId);
  });
  roomClient.on("disconnect", () => {
    resumeAttempt += 1;
    updateConnection("Reconnecting…", "reconnecting");
    lobbyRenderer.setConnected(false); gameRenderer.setConnected(false); exchangeRenderer.setConnected(false); resultsRenderer.setConnected(false);
  });
  roomClient.on("connect", async () => {
    if (!activeSession) {
      updateConnection("Connected", "connected");
      lobbyRenderer.setConnected(true); gameRenderer.setConnected(true); exchangeRenderer.setConnected(true); resultsRenderer.setConnected(true);
      return;
    }
    const attempt = ++resumeAttempt;
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
    updateConnection("Connected", "connected");
    lobbyRenderer.setConnected(true); gameRenderer.setConnected(true); exchangeRenderer.setConnected(true); resultsRenderer.setConnected(true);
    if (response.game) gameClient.accept(response.game);
    if (response.exchange) exchangeClient.accept(response.exchange);
    if (response.room.status === "lobby") {
      lobbyRenderer.update(response.room, activeSession.playerId); manager.show("lobby");
    } else if (response.room.status === "playing") manager.show("game");
    else if (response.room.status === "exchange") manager.show("exchange");
    else if (response.room.status === "round_complete") manager.show("results");
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
  socket.on("connect_error", () => updateConnection(navigator.onLine ? "Reconnecting…" : "Offline", navigator.onLine ? "reconnecting" : "offline"));
} else updateConnection("Disconnected", "disconnected");

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-go]");
  if (!link) return;
  if (!demoMode && ["game", "exchange", "results", "lobby"].includes(link.dataset.go)) return;
  manager.show(link.dataset.go);
});

const bindForm = (formId, errorId, mode) => {
  const form = byId(formId);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type=submit]");
    if (submit.disabled) return;
    const data = new FormData(form);
    const name = validateDisplayName(data.get("displayName"));
    const code = mode === "join" ? normaliseRoomCode(data.get("roomCode")) : "ABCD";
    const error = byId(errorId);
    if (!name.valid) { error.textContent = name.message; return; }
    if (mode === "join" && code.length !== 4) { error.textContent = "Enter a four-character room code."; return; }
    if (demoMode) {
      demoController.setIdentity(name.value, mode === "create", code); manager.show("lobby"); return;
    }
    if (!roomClient?.connected) { error.textContent = "Connect to the server before using room controls."; return; }
    error.textContent = ""; submit.disabled = true; submit.textContent = mode === "create" ? "Creating…" : "Joining…";
    const response = mode === "create" ? await roomClient.create(name.value) : await roomClient.join(name.value, code);
    submit.disabled = false; submit.textContent = mode === "create" ? "Create Room" : "Join Room";
    if (!response.ok) { handleResponseError(response, errorId); return; }
    activeSession = response.session; saveRoomSession(activeSession);
    lobbyRenderer.update(response.room, activeSession.playerId); manager.show("lobby");
  });
};
bindForm("create-form", "create-error", "create");
bindForm("join-form", "join-error", "join");

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
roomInput.addEventListener("input", () => { roomInput.value = normaliseRoomCode(roomInput.value); });
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
if (sharedCode && !demoMode) {
  roomInput.value = sharedCode; manager.show("join", { updateHistory: false });
} else {
  let initial = normaliseScreen(params.get("screen"));
  if (!demoMode && ["game", "exchange", "results", "lobby"].includes(initial)) initial = "home";
  manager.show(initial, { updateHistory: false });
}
