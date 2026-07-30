import assert from "node:assert/strict";
import { io as createClient } from "socket.io-client";
import { createApplication } from "../server.js";
import { createConfig } from "../src/config.js";
import { silentLogger } from "../src/logger.js";

const once = (socket, event, timeoutMs = 3_000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
});
const request = (socket, event, payload) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out requesting ${event}`)), 3_000);
  socket.emit(event, payload, (value) => { clearTimeout(timer); resolve(value); });
});

const application = createApplication({
  config: createConfig({ NODE_ENV: "test", PORT: "0", TURN_DURATION_MS: "5000" }),
  logger: silentLogger,
});
const sockets = [];
try {
  const address = await application.start({ port: 0, host: "127.0.0.1" });
  const origin = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal((await fetch(`${origin}/ready`)).status, 200);
  const cardAsset = await fetch(`${origin}/assets/cards/3-clubs.svg`);
  assert.equal(cardAsset.status, 200);
  assert.match(cardAsset.headers.get("content-type") ?? "", /image\/svg\+xml/);

  const first = createClient(origin, { transports: ["websocket"], forceNew: true });
  const second = createClient(origin, { transports: ["websocket"], forceNew: true });
  sockets.push(first, second);
  await Promise.all([once(first, "connect"), once(second, "connect")]);
  const malformed = await request(first, "room:create", []);
  assert.equal(malformed.error.code, "INVALID_PAYLOAD");
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  const created = await request(first, "room:create", { displayName: "Alpha" });
  assert.equal(created.ok, true);
  const joined = await request(second, "room:join", { roomCode: created.room.code, displayName: "Bravo" });
  assert.equal(joined.ok, true);

  const firstStarted = once(first, "game:roundStarted");
  const secondStarted = once(second, "game:roundStarted");
  assert.equal((await request(first, "room:setReady", { ready: true })).ok, true);
  assert.equal((await request(second, "room:setReady", { ready: true })).ok, true);
  const [firstView, secondView] = await Promise.all([firstStarted, secondStarted]);
  assert.ok(firstView.you.hand.length);
  assert.ok(secondView.you.hand.length);
  assert.equal(JSON.stringify(firstView).includes(secondView.you.hand[0].id), false);
  assert.equal(JSON.stringify(secondView).includes(firstView.you.hand[0].id), false);

  const openingView = firstView.currentPlayerId === firstView.you.id ? firstView : secondView;
  const openingSocket = firstView.currentPlayerId === firstView.you.id ? first : second;
  const observingSocket = openingSocket === first ? second : first;
  const openingCards = openingView.you.hand.filter((card) => card.id === "3-clubs");
  const publicUpdate = once(observingSocket, "game:update");
  assert.equal((await request(openingSocket, "game:play", { cardIds: openingCards.map(({ id }) => id) })).ok, true);
  assert.equal((await publicUpdate).currentPlay.cards[0].id, "3-clubs");

  const identity = joined.session.playerId;
  const handIds = secondView.you.hand
    .filter(({ id }) => !(openingSocket === second && id === "3-clubs"))
    .map(({ id }) => id).sort();
  second.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const resumedSocket = createClient(origin, { transports: ["websocket"], forceNew: true });
  sockets.push(resumedSocket);
  await once(resumedSocket, "connect");
  const resumed = await request(resumedSocket, "room:resume", joined.session);
  assert.equal(resumed.ok, true);
  assert.equal(resumed.session.playerId, identity);
  assert.deepEqual(resumed.game.you.hand.map(({ id }) => id).sort(), handIds);
  assert.equal((await request(resumedSocket, "room:leave", {})).ok, true);
  assert.equal((await request(first, "room:leave", {})).ok, true);

  const flood = createClient(origin, { transports: ["websocket"], forceNew: true });
  sockets.push(flood);
  await once(flood, "connect");
  let limited;
  for (let index = 0; index < 31; index += 1) {
    limited = await request(flood, "room:create", { displayName: "Flood" });
  }
  assert.equal(limited.error.code, "RATE_LIMITED");
  assert.equal(application.roomManager.rooms.size, 1);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  console.log("Smoke test passed: health, SVG asset serving, malformed input, throttling, two-player game, private views, legal play, resume, cleanup.");
} finally {
  sockets.forEach((socket) => socket.disconnect());
  await application.stop("smoke_test");
}
