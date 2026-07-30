import test from "node:test";
import assert from "node:assert/strict";
import { createGameClient } from "../../public/js/network/gameClient.js";

const socketHarness = () => {
  const handlers = new Map();
  const requests = [];
  return {
    socket: {
      on: (event, handler) => handlers.set(event, handler),
      emit: (event, payload, ack) => requests.push({ event, payload, ack }),
    },
    handlers,
    requests,
  };
};

test("game client ignores older revisions", () => {
  const { socket, handlers } = socketHarness();
  const client = createGameClient(socket);
  const seen = []; client.onUpdate((view) => seen.push(view.revision));
  handlers.get("game:update")({ revision: 4 });
  handlers.get("game:update")({ revision: 3 });
  assert.equal(client.view.revision, 4);
  assert.deepEqual(seen, [4]);
});
test("game client sends only selected IDs and no identity fields", async () => {
  const { socket, requests } = socketHarness();
  const client = createGameClient(socket);
  const pending = client.play(["7-hearts"]);
  assert.deepEqual(requests[0].payload, { cardIds: ["7-hearts"] });
  requests[0].ack({ ok: true, revision: 2 });
  assert.deepEqual(await pending, { ok: true, revision: 2 });
});
test("game client sends only allowed ten and Consecutive options", async () => {
  const { socket, requests } = socketHarness();
  const client = createGameClient(socket);
  const pending = client.play(["10-hearts"], { direction: "lower", consecutive: true, playerId: "secret" });
  assert.deepEqual(requests[0].payload, { cardIds: ["10-hearts"], direction: "lower", consecutive: true });
  requests[0].ack({ ok: true, revision: 2 });
  await pending;
});
test("pending actions prevent duplicate rapid submissions", async () => {
  const { socket, requests } = socketHarness();
  const client = createGameClient(socket);
  const first = client.pass();
  const duplicate = await client.pass();
  assert.equal(duplicate.ok, false);
  assert.equal(requests.length, 1);
  requests[0].ack({ ok: true, revision: 2 });
  await first;
});
