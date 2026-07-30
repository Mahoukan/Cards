const INVALID = Object.freeze({
  ok: false,
  error: { code: "INVALID_PAYLOAD", message: "That request was not valid." },
});

export const plainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export const validatePayload = (payload, schema = {}) => {
  if (!plainObject(payload)) return INVALID;
  const value = {};
  for (const [key, rule] of Object.entries(schema)) {
    const item = payload[key];
    if (item === undefined && rule.optional) continue;
    if (rule.type === "string") {
      if (typeof item !== "string" || item.length < (rule.min ?? 0) || item.length > (rule.max ?? Infinity)) return INVALID;
    } else if (rule.type === "boolean") {
      if (typeof item !== "boolean") return INVALID;
    } else if (rule.type === "stringArray") {
      if (!Array.isArray(item) || item.length > rule.max || item.some((entry) => typeof entry !== "string" || !entry || entry.length > (rule.itemMax ?? 100))) return INVALID;
    } else if (rule.type === "any") {
      // Authoritative domain validation handles this value.
    } else return INVALID;
    value[key] = item;
  }
  return { ok: true, value };
};

export class SocketActionLimiter {
  constructor({ limit = 30, windowMs = 10_000, now = Date.now } = {}) {
    this.limit = limit; this.windowMs = windowMs; this.now = now; this.usage = new Map();
  }
  take(socketId) {
    const time = this.now();
    let record = this.usage.get(socketId);
    if (!record || time - record.startedAt >= this.windowMs) record = { startedAt: time, count: 0 };
    record.count += 1; this.usage.set(socketId, record);
    return record.count <= this.limit;
  }
  clear(socketId) { this.usage.delete(socketId); }
  clearAll() { this.usage.clear(); }
}

const internalFailure = Object.freeze({
  ok: false,
  error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong. Please try again." },
});
const limitedFailure = Object.freeze({
  ok: false,
  error: { code: "RATE_LIMITED", message: "Too many actions. Please wait a moment." },
});

export const socketRequest = ({ socket, event, schema, limiter, logger, handler }) => {
  socket.on(event, async (payload, ack) => {
    if (typeof ack !== "function") return;
    let acknowledged = false;
    const reply = (value) => {
      if (acknowledged) return;
      acknowledged = true;
      ack(value);
    };
    if (!limiter.take(socket.id)) return reply(limitedFailure);
    const parsed = validatePayload(payload, schema);
    if (!parsed.ok) return reply(parsed);
    try {
      reply(await handler(parsed.value));
    } catch (error) {
      logger.error("socket_handler_error", { event, socketId: socket.id, error: error?.stack ?? String(error) });
      reply(internalFailure);
    }
  });
};
