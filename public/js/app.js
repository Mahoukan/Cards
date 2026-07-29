import { createDemoController, normaliseRoomCode, validateDisplayName } from "./demo/demoController.js";
import { createDemoState } from "./demo/demoState.js";
import { createRoomClient } from "./network/roomClient.js";
import { clearRoomSession, readRoomSession, saveRoomSession } from "./network/sessionStorage.js";
import { createLobbyRenderer } from "./ui/lobbyRenderer.js";
import { createScreenManager, normaliseScreen } from "./ui/screenManager.js";

const params = new URLSearchParams(location.search);
const demoMode = params.get("demo") === "1";
const connectionNodes = [...document.querySelectorAll("[data-connection]")];
const byId = (id) => document.getElementById(id);
const setHomeMessage = (message) => { byId("home-message").textContent = message; };
const updateConnection = (label, state) => connectionNodes.forEach((node) => {
  node.textContent = label; node.dataset.state = state;
});

const socket = typeof window.io === "function" ? window.io() : null;
const roomClient = socket ? createRoomClient(socket) : null;
let activeSession = demoMode ? null : readRoomSession();
let demoController;
let lobbyRenderer;

const manager = createScreenManager({
  onChange: (screen) => {
    if (demoMode) demoController?.enter(screen);
    else if (screen === "lobby" && (!activeSession || !roomClient?.room)) {
      setHomeMessage("Create, join, or resume a room before opening the lobby.");
      queueMicrotask(() => manager.show("home"));
    }
  },
});

const returnHome = (message, { clearStored = true } = {}) => {
  if (clearStored) clearRoomSession();
  activeSession = null; roomClient?.clear(); lobbyRenderer?.clear();
  setHomeMessage(message); manager.show("home");
};

const handleResponseError = (response, target = "home-message") => {
  byId(target).textContent = response?.error?.message ?? "The room request could not be completed.";
};

if (demoMode) {
  const state = createDemoState();
  demoController = createDemoController({ state, navigate: (screen) => manager.show(screen) });
  byId("leave-button").addEventListener("click", () => manager.show("home"));
} else if (roomClient) {
  lobbyRenderer = createLobbyRenderer({
    onReady: async (ready) => {
      lobbyRenderer.setBusy(true);
      const response = await roomClient.setReady(ready);
      lobbyRenderer.setBusy(false);
      if (response.ok) lobbyRenderer.update(response.room, activeSession.playerId);
      else handleResponseError(response, "lobby-status");
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
      else { lobbyRenderer.setBusy(false); handleResponseError(response, "lobby-status"); }
    },
  });

  roomClient.on("update", (room) => {
    if (!activeSession || room.code !== activeSession.roomCode) return;
    lobbyRenderer.update(room, activeSession.playerId);
  });
  roomClient.on("ready", (room) => {
    if (activeSession) lobbyRenderer.update(room, activeSession.playerId);
  });
  roomClient.on("disconnect", () => {
    updateConnection("Reconnecting…", "reconnecting");
    lobbyRenderer.setConnected(false);
  });
  roomClient.on("connect", async () => {
    updateConnection("Connected", "connected");
    lobbyRenderer.setConnected(true);
    if (!activeSession) return;
    const response = await roomClient.resume(activeSession);
    if (response.ok) {
      activeSession = response.session;
      saveRoomSession(activeSession);
      lobbyRenderer.update(response.room, activeSession.playerId);
      manager.show("lobby");
    } else {
      returnHome("Your saved room session has expired. Please create or join again.");
    }
  });
  roomClient.on("kicked", () => returnHome("The host removed you from the room."));
  roomClient.on("replaced", () => returnHome("This room was opened in another tab.", { clearStored: false }));
  socket.on("connect_error", () => updateConnection("Disconnected", "disconnected"));
} else {
  updateConnection("Disconnected", "disconnected");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-go]");
  if (!link) return;
  const target = link.dataset.go;
  if (!demoMode && ["game", "results"].includes(target)) {
    returnHome("The game and results are design prototypes. Use a demo=1 URL to review them.", { clearStored: false });
    return;
  }
  manager.show(target);
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
      demoController.setIdentity(name.value, mode === "create", code);
      manager.show("lobby"); return;
    }
    if (!roomClient?.connected) { error.textContent = "Connect to the server before using room controls."; return; }
    error.textContent = ""; submit.disabled = true; submit.textContent = mode === "create" ? "Creating…" : "Joining…";
    const response = mode === "create" ? await roomClient.create(name.value) : await roomClient.join(name.value, code);
    submit.disabled = false; submit.textContent = mode === "create" ? "Create Room" : "Join Room";
    if (!response.ok) { handleResponseError(response, errorId); return; }
    activeSession = response.session;
    saveRoomSession(activeSession);
    lobbyRenderer.update(response.room, activeSession.playerId);
    manager.show("lobby");
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
window.addEventListener("popstate", () => manager.show(new URLSearchParams(location.search).get("screen"), { updateHistory: false }));

const sharedCode = normaliseRoomCode(params.get("room"));
if (sharedCode && !demoMode) {
  roomInput.value = sharedCode;
  manager.show("join", { updateHistory: false });
} else {
  let initial = normaliseScreen(params.get("screen"));
  if (!demoMode && ["game", "results"].includes(initial)) {
    initial = "home";
    setHomeMessage("Game and results are available for design review with ?demo=1.");
  }
  manager.show(initial, { updateHistory: false });
}
