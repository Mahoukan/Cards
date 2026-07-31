export const TURN_DURATION_MS = 30_000;

export class TurnTimer {
  constructor({ now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout, durationMs = TURN_DURATION_MS, onTimeout = () => {} } = {}) {
    this.now = now; this.schedule = schedule; this.cancelSchedule = cancelSchedule;
    this.durationMs = durationMs; this.onTimeout = onTimeout; this.active = new Map();
  }

  start(roomCode, playerId) {
    this.clear(roomCode);
    const deadline = this.now() + this.durationMs;
    const record = { playerId, deadline, handle: null };
    record.handle = this.schedule(() => {
      if (this.active.get(roomCode) !== record) return;
      this.active.delete(roomCode);
      this.onTimeout({ roomCode, playerId, deadline });
    }, this.durationMs);
    this.active.set(roomCode, record);
    return deadline;
  }

  clear(roomCode) {
    const record = this.active.get(roomCode);
    if (record) this.cancelSchedule(record.handle);
    this.active.delete(roomCode);
  }

  getDeadline(roomCode) {
    return this.active.get(roomCode)?.deadline ?? null;
  }

  clearAll() {
    [...this.active.keys()].forEach((code) => this.clear(code));
  }
}
