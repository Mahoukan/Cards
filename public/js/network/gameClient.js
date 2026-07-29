import { createActionRequester } from "./actionRequest.js";

export const createGameClient = (socket, options) => {
  let view = null;
  let busy = false;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener(view));
  const accept = (nextView) => {
    if (!nextView || (view && nextView.revision < view.revision)) return false;
    view = nextView; notify(); return true;
  };
  socket.on("game:update", accept);
  socket.on("game:roundStarted", accept);
  socket.on("game:roundComplete", accept);
  const requester = createActionRequester(socket, options);
  return {
    onUpdate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    async play(cardIds) {
      if (busy) return { ok: false, error: { message: "An action is already pending." } };
      busy = true;
      try { return await requester.request("game:play", { cardIds }); } finally { busy = false; }
    },
    async pass() {
      if (busy) return { ok: false, error: { message: "An action is already pending." } };
      busy = true;
      try { return await requester.request("game:pass", {}); } finally { busy = false; }
    },
    clear() { requester.clear(); view = null; },
    get view() { return view; },
    get busy() { return busy; },
  };
};
