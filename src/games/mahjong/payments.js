const DRAW_SOURCES = new Set(["self-draw", "kong-replacement", "last-live-tile"]);
const DISCARD_SOURCES = new Set(["discard", "robbed-kong"]);

export const calculatePayments = ({
  playerIds, winnerPlayerId, responsiblePlayerId, winSource, fan,
} = {}) => {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || new Set(playerIds).size !== playerIds.length) {
    throw new TypeError("playerIds must contain unique player IDs.");
  }
  if (!playerIds.includes(winnerPlayerId)) throw new RangeError("Winner must be an active player.");
  if (!Number.isInteger(fan) || fan < 0) throw new RangeError("Fan must be a nonnegative integer.");
  if (!DRAW_SOURCES.has(winSource) && !DISCARD_SOURCES.has(winSource)) throw new RangeError("Unsupported win source.");
  if (DISCARD_SOURCES.has(winSource) && (!playerIds.includes(responsiblePlayerId) || responsiblePlayerId === winnerPlayerId)) {
    throw new RangeError("A discard-style win requires a different responsible player.");
  }
  const basePayment = 2 ** fan;
  const deltas = Object.fromEntries(playerIds.map((id) => [id, 0]));
  if (DRAW_SOURCES.has(winSource)) {
    for (const playerId of playerIds) {
      if (playerId === winnerPlayerId) continue;
      deltas[playerId] -= basePayment;
      deltas[winnerPlayerId] += basePayment;
    }
  } else {
    deltas[responsiblePlayerId] -= basePayment;
    deltas[winnerPlayerId] += basePayment;
  }
  if (Object.values(deltas).reduce((sum, value) => sum + value, 0) !== 0) {
    throw new Error("Payment calculation must be zero-sum.");
  }
  return { fan, basePayment, winSource, deltas };
};
