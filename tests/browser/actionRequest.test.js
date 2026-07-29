import assert from "node:assert/strict";
import test from "node:test";
import { createActionRequester } from "../../public/js/network/actionRequest.js";

test("action requests time out, suppress duplicates, and stay disabled offline", async () => {
  let callback;
  const socket = { connected: true, emit: (_event, _payload, ack) => { callback = ack; } };
  let timeout;
  const requester = createActionRequester(socket, { schedule: (fn) => { timeout = fn; return 1; }, cancelSchedule() {} });
  const first = requester.request("game:play", {});
  assert.equal((await requester.request("game:play", {})).error.code, "ACTION_PENDING");
  timeout();
  assert.equal((await first).error.code, "ACK_TIMEOUT");
  callback({ ok: true });
  socket.connected = false;
  assert.equal((await requester.request("game:pass", {})).error.code, "OFFLINE");
});

