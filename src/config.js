const LEVELS = new Set(["error", "warn", "info", "debug", "silent"]);

const integer = (source, name, fallback, { minimum = 0 } = {}) => {
  const raw = source[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) throw new Error(`${name} must be a whole number.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a whole number of at least ${minimum}.`);
  }
  return value;
};

const origin = (raw) => {
  if (raw === undefined || raw === "") return null;
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("PUBLIC_ORIGIN must be a valid http or https origin."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("PUBLIC_ORIGIN must contain only an http or https origin.");
  }
  return parsed.origin;
};

export const createConfig = (source = process.env) => {
  const nodeEnv = source.NODE_ENV || "development";
  const logLevel = source.LOG_LEVEL || (nodeEnv === "test" ? "silent" : "info");
  if (!LEVELS.has(logLevel)) throw new Error("LOG_LEVEL must be error, warn, info, debug, or silent.");
  return Object.freeze({
    nodeEnv,
    port: integer(source, "PORT", 3000, { minimum: 0 }),
    publicOrigin: origin(source.PUBLIC_ORIGIN),
    logLevel,
    roomReconnectGraceMs: integer(source, "ROOM_RECONNECT_GRACE_MS", 60_000, { minimum: 1 }),
    turnDurationMs: integer(source, "TURN_DURATION_MS", 30_000, { minimum: 1 }),
    socketActionLimit: integer(source, "SOCKET_ACTION_LIMIT", 30, { minimum: 1 }),
    socketActionWindowMs: integer(source, "SOCKET_ACTION_WINDOW_MS", 10_000, { minimum: 1 }),
  });
};

