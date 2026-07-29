export const ACK_TIMEOUT_MS = 8_000;
export const OFFLINE_RESPONSE = Object.freeze({
  ok: false, error: { code: "OFFLINE", message: "Reconnect before trying that action." },
});
export const TIMEOUT_RESPONSE = Object.freeze({
  ok: false, error: { code: "ACK_TIMEOUT", message: "No response was received. Check your connection and try again." },
});
export const PENDING_RESPONSE = Object.freeze({
  ok: false, error: { code: "ACTION_PENDING", message: "An action is already pending." },
});

export const createActionRequester = (socket, { timeoutMs = ACK_TIMEOUT_MS, schedule = setTimeout, cancelSchedule = clearTimeout } = {}) => {
  const pending = new Set();
  const request = (event, payload) => {
    if (socket.connected === false) return Promise.resolve(OFFLINE_RESPONSE);
    if (pending.has(event)) return Promise.resolve(PENDING_RESPONSE);
    pending.add(event);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (response) => {
        if (settled) return;
        settled = true; cancelSchedule(timer); pending.delete(event); resolve(response);
      };
      const timer = schedule(() => finish(TIMEOUT_RESPONSE), timeoutMs);
      socket.emit(event, payload, (response) => finish(response ?? TIMEOUT_RESPONSE));
    });
  };
  return { request, isPending: (event) => pending.has(event), clear: () => pending.clear() };
};
