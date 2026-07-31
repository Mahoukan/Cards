import { createActionRequester } from "./actionRequest.js";

export const createMahjongClient = (socket, options) => {
  let view = null; let busy = false; const listeners = new Set();
  const requester = createActionRequester(socket, options);
  const accept = (next) => {
    if (!next || (view && next.revision < view.revision)) return false;
    view = next; listeners.forEach((listener) => listener(view)); return true;
  };
  socket.on("mahjong:update", accept);
  socket.on("mahjong:round-started", accept);
  socket.on("mahjong:round-complete", accept);
  const request = async (event, payload = {}) => {
    if (busy) return { ok: false, error: { message: "An action is already pending." } };
    busy = true;
    try { return await requester.request(event, payload); } finally { busy = false; }
  };
  return {
    onUpdate(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    accept,
    discard(tileId) { return request("mahjong:discard", { tileId }); },
    claim(type, tileIds) { return request("mahjong:claim", { type, ...(tileIds ? { tileIds } : {}) }); },
    declareWin() { return request("mahjong:declare-win"); },
    declareKong(payload) { return request("mahjong:declare-kong", payload); },
    clear() { requester.clear(); view = null; },
    get view() { return view; },
  };
};
