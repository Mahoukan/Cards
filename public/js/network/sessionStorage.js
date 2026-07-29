export const SESSION_STORAGE_KEY = "president.activeRoomSession";

export const readRoomSession = (storage = globalThis.localStorage) => {
  try {
    const parsed = JSON.parse(storage?.getItem(SESSION_STORAGE_KEY));
    if (
      !parsed || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype ||
      typeof parsed.roomCode !== "string" || !/^[A-Z2-9]{4}$/.test(parsed.roomCode) ||
      typeof parsed.playerId !== "string" || !parsed.playerId || parsed.playerId.length > 100 ||
      typeof parsed.reconnectToken !== "string" || !parsed.reconnectToken || parsed.reconnectToken.length > 200
    ) return null;
    return { roomCode: parsed.roomCode, playerId: parsed.playerId, reconnectToken: parsed.reconnectToken };
  } catch {
    return null;
  }
};

export const saveRoomSession = (session, storage = globalThis.localStorage) => {
  try {
    if (!session || typeof session.roomCode !== "string" || typeof session.playerId !== "string" || typeof session.reconnectToken !== "string") return false;
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      roomCode: session.roomCode, playerId: session.playerId, reconnectToken: session.reconnectToken,
    })); return true;
  }
  catch { return false; }
};

export const clearRoomSession = (storage = globalThis.localStorage) => {
  try { storage?.removeItem(SESSION_STORAGE_KEY); return true; }
  catch { return false; }
};
