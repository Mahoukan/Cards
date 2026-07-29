import test from "node:test";
import assert from "node:assert/strict";
import { createExchangeClient } from "../../public/js/network/exchangeClient.js";

const fakeSocket = () => {
  const handlers = new Map();
  const emitted = [];
  return {
    emitted,
    on(event, handler) { handlers.set(event, handler); },
    emit(event, payload, ack) {
      emitted.push({ event, payload });
      ack?.({ ok: true, revision: 2 });
    },
    receive(event, payload) { handlers.get(event)?.(payload); },
  };
};

test("exchange client ignores older revisions separately from game state", () => {
  const socket = fakeSocket();
  const client = createExchangeClient(socket);
  socket.receive("exchange:update", { revision: 4, roundNumber: 2 });
  socket.receive("exchange:update", { revision: 3, roundNumber: 99 });
  assert.equal(client.view.roundNumber, 2);
});

test("exchange client sends only selected card IDs", async () => {
  const socket = fakeSocket();
  const client = createExchangeClient(socket);
  const response = await client.returnCards(["4-clubs", "9-hearts"]);
  assert.equal(response.ok, true);
  assert.deepEqual(socket.emitted[0], {
    event: "exchange:returnCards",
    payload: { cardIds: ["4-clubs", "9-hearts"] },
  });
});

test("exchange client blocks duplicate pending returns", async () => {
  let ack;
  const socket = {
    on() {},
    emit(_event, _payload, callback) { ack = callback; },
  };
  const client = createExchangeClient(socket);
  const pending = client.returnCards(["4-clubs"]);
  const duplicate = await client.returnCards(["5-clubs"]);
  assert.equal(duplicate.ok, false);
  ack({ ok: true, revision: 2 });
  assert.equal((await pending).ok, true);
});
