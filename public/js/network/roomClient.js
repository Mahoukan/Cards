export const createRoomClient = (socket) => {
  let session = null;
  let room = null;
  const listeners = new Map();
  const notify = (event, value) => listeners.get(event)?.forEach((listener) => listener(value));
  const request = (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

  socket.on("room:update", (nextRoom) => { room = nextRoom; notify("update", nextRoom); });
  socket.on("room:readyToStart", (nextRoom) => { room = nextRoom; notify("ready", nextRoom); });
  socket.on("room:kicked", () => notify("kicked"));
  socket.on("room:sessionReplaced", () => { session = null; room = null; notify("replaced"); });
  socket.on("connect", () => notify("connect"));
  socket.on("disconnect", () => notify("disconnect"));

  const authenticatedRequest = async (event, payload) => {
    const response = await request(event, payload);
    if (response?.ok && response.room !== undefined) room = response.room;
    return response;
  };

  return {
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
    async create(displayName) {
      const response = await authenticatedRequest("room:create", { displayName });
      if (response.ok) session = response.session;
      return response;
    },
    async join(displayName, roomCode) {
      const response = await authenticatedRequest("room:join", { displayName, roomCode });
      if (response.ok) session = response.session;
      return response;
    },
    async resume(savedSession) {
      const response = await authenticatedRequest("room:resume", savedSession);
      if (response.ok) session = response.session;
      return response;
    },
    setReady(ready) { return authenticatedRequest("room:setReady", { ready }); },
    kick(playerId) { return authenticatedRequest("room:kick", { playerId }); },
    leave() { return authenticatedRequest("room:leave", {}); },
    clear() { session = null; room = null; },
    get session() { return session; },
    get room() { return room; },
    get connected() { return socket.connected; },
  };
};
