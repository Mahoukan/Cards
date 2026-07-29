export const SESSION_STORAGE_KEY = "president.activeRoomSession";

export const readRoomSession = (storage = globalThis.localStorage) => {
  try {
    const parsed = JSON.parse(storage?.getItem(SESSION_STORAGE_KEY));
    if (
      typeof parsed?.roomCode !== "string" ||
      typeof parsed?.playerId !== "string" ||
      typeof parsed?.reconnectToken !== "string"
    ) return null;
    return { roomCode: parsed.roomCode, playerId: parsed.playerId, reconnectToken: parsed.reconnectToken };
  } catch {
    return null;
  }
};

export const saveRoomSession = (session, storage = globalThis.localStorage) => {
  try { storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)); return true; }
  catch { return false; }
};

export const clearRoomSession = (storage = globalThis.localStorage) => {
  try { storage?.removeItem(SESSION_STORAGE_KEY); return true; }
  catch { return false; }
};
