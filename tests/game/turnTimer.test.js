import test from "node:test";
import assert from "node:assert/strict";
import { TurnTimer } from "../../src/game/turnTimer.js";

test("turn timer creates one absolute deadline and replaces prior timers", () => {
  let now = 1000; let id = 0;
  const jobs = new Map(); const cancelled = [];
  const timer = new TurnTimer({
    now: () => now,
    durationMs: 30_000,
    schedule: (callback) => { const handle = ++id; jobs.set(handle, callback); return handle; },
    cancelSchedule: (handle) => { cancelled.push(handle); jobs.delete(handle); },
  });
  assert.equal(timer.start("ABCD", "p1"), 31_000);
  now = 2000;
  assert.equal(timer.start("ABCD", "p2"), 32_000);
  assert.deepEqual(cancelled, [1]);
  assert.equal(jobs.size, 1);
});
test("stale callbacks cannot affect a newer turn", () => {
  const callbacks = []; const fired = [];
  const timer = new TurnTimer({
    now: () => 0,
    schedule: (callback) => { callbacks.push(callback); return callbacks.length; },
    cancelSchedule: () => {},
    onTimeout: (value) => fired.push(value),
  });
  timer.start("ABCD", "p1");
  timer.start("ABCD", "p2");
  callbacks[0](); callbacks[1]();
  assert.deepEqual(fired, [{ roomCode: "ABCD", playerId: "p2", deadline: 30_000 }]);
});
test("clear and clearAll cancel active room timers", () => {
  const cancelled = [];
  const timer = new TurnTimer({ now: () => 0, schedule: () => Symbol(), cancelSchedule: (handle) => cancelled.push(handle) });
  timer.start("AAAA", "p1"); timer.start("BBBB", "p2");
  timer.clear("AAAA"); timer.clearAll();
  assert.equal(cancelled.length, 2);
  assert.equal(timer.getDeadline("BBBB"), null);
});
