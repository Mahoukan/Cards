import { createActionRequester } from "./actionRequest.js";

export const createExchangeClient = (socket, options) => {
  let view = null;
  let busy = false;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener(view));
  const accept = (nextView) => {
    if (!nextView || (view && nextView.revision < view.revision)) return false;
    view = nextView; notify(); return true;
  };
  socket.on("exchange:update", accept);
  socket.on("exchange:started", accept);
  socket.on("exchange:complete", accept);
  const requester = createActionRequester(socket, options);
  return {
    onUpdate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    async returnCards(cardIds) {
      if (busy) return { ok: false, error: { message: "An action is already pending." } };
      busy = true;
      try { return await requester.request("exchange:returnCards", { cardIds }); } finally { busy = false; }
    },
    clear() { requester.clear(); view = null; },
    get view() { return view; },
    get busy() { return busy; },
  };
};
