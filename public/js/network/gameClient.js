export const createGameClient = (socket) => {
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
  const request = (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
  return {
    onUpdate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    async play(cardIds) {
      if (busy) return { ok: false, error: { message: "An action is already pending." } };
      busy = true;
      try { return await request("game:play", { cardIds }); } finally { busy = false; }
    },
    async pass() {
      if (busy) return { ok: false, error: { message: "An action is already pending." } };
      busy = true;
      try { return await request("game:pass", {}); } finally { busy = false; }
    },
    clear() { view = null; },
    get view() { return view; },
    get busy() { return busy; },
  };
};
