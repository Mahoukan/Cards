import { createActionRequester } from "./actionRequest.js";

export const createCrazyEightsClient = (socket, options) => {
  let view = null;
  const listeners = new Set();
  const requester = createActionRequester(socket, options);
  let busy = false;
  const accept = (next) => {
    if (!next || (view && next.revision < view.revision)) return false;
    view = next;
    listeners.forEach((listener) => listener(view));
    return true;
  };
  socket.on("crazy-eights:update", accept);
  socket.on("crazy-eights:round-started", accept);
  socket.on("crazy-eights:round-complete", accept);
  const request = async (event, payload = {}) => {
    if (busy) return { ok: false, error: { message: "An action is already pending." } };
    busy = true;
    try { return await requester.request(event, payload); } finally { busy = false; }
  };
  return {
    onUpdate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    play(cardId, chosenSuit) {
      return request("crazy-eights:play", { cardId, ...(chosenSuit ? { chosenSuit } : {}) });
    },
    draw() { return request("crazy-eights:draw"); },
    keepDrawn() { return request("crazy-eights:keep-drawn"); },
    clear() { requester.clear(); view = null; },
    get view() { return view; },
  };
};
