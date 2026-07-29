import { createDemoController, normaliseRoomCode, validateDisplayName } from "./demo/demoController.js";
import { createDemoState } from "./demo/demoState.js";
import { createScreenManager, normaliseScreen } from "./ui/screenManager.js";

const connectionNodes = [...document.querySelectorAll("[data-connection]")];
const updateConnection = (label, state) => connectionNodes.forEach((node) => {
  node.textContent = label; node.dataset.state = state;
});

if (typeof window.io === "function") {
  const socket = window.io();
  socket.on("connect", () => updateConnection("Connected", "connected"));
  socket.on("disconnect", () => updateConnection("Disconnected", "disconnected"));
  socket.io.on("reconnect_attempt", () => updateConnection("Reconnecting…", "reconnecting"));
  socket.on("connect_error", () => updateConnection("Disconnected", "disconnected"));
}

const state = createDemoState();
let controller;
const manager = createScreenManager({ onChange: (screen) => controller?.enter(screen) });
controller = createDemoController({ state, navigate: (screen) => manager.show(screen) });

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-go]");
  if (!link) return;
  manager.show(link.dataset.go);
});

const bindForm = (formId, errorId, isJoin) => {
  document.getElementById(formId).addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = validateDisplayName(data.get("displayName"));
    const code = isJoin ? normaliseRoomCode(data.get("roomCode")) : "ABCD";
    const error = document.getElementById(errorId);
    if (!name.valid) { error.textContent = name.message; return; }
    if (isJoin && code.length !== 4) { error.textContent = "Enter a four-character room code."; return; }
    error.textContent = "";
    controller.setIdentity(name.value, !isJoin, code);
    manager.show("lobby");
  });
};
bindForm("create-form", "create-error", false);
bindForm("join-form", "join-error", true);

const roomInput = document.getElementById("room-code");
roomInput.addEventListener("input", () => { roomInput.value = normaliseRoomCode(roomInput.value); });
window.addEventListener("popstate", () => manager.show(new URLSearchParams(location.search).get("screen"), { updateHistory: false }));

const params = new URLSearchParams(location.search);
const initial = normaliseScreen(params.get("screen"));
if (params.has("room")) state.roomCode = normaliseRoomCode(params.get("room")) || "ABCD";
manager.show(initial, { updateHistory: false });
