# President

A mobile-first, server-authoritative President card game for private groups.

## Status

Stage 6 supports repeated server-authoritative rounds in the same private room. Ready lobbies start automatically, the server shuffles and deals private hands, validates plays and passes, owns 30-second turns, handles forfeits, produces real finishing roles, runs next-round readiness, performs President/Scum exchanges, and starts later rounds with Scum.

Not implemented yet: accounts, persistence, public matchmaking, chat, spectators, bots, match history outside the active room, overall match scoring, configurable house rules, or sound effects.

Rooms and active games exist only in one server process. A restart or Railway redeployment removes all rooms, prepared exchanges, and games.

## Playing

Create a room and share its four-character code or invite URL:

```text
/?room=ABCD
```

When every connected player is ready and at least two players are present, the server starts Round 1 immediately. The player holding 3 of Clubs opens and must include it in the first play. The server sends each browser its own hand and only card counts for opponents.

Each turn has an absolute 30-second server deadline. A timeout passes on an active pile or skips the leader on an empty pile. The browser countdown is display-only.

The original browser stores a private reconnect credential under `president.activeRoomSession`. Refreshing or reconnecting within 60 seconds restores the same seat and hand without resetting the turn deadline. Leaving, being kicked, or exceeding the grace period forfeits an unfinished active round.

## Repeated rounds

After round completion, remaining room players can ready for the next round. When everyone is connected and ready, the server recalculates roles using the previous finish order filtered to current room members, deals the next round, transfers required highest cards from lower roles, and enters `exchange`.

President returns any two cards to Scum. In games with four to six current players, Vice President also returns any one card to Vice Scum. Return cards may be mixed rank and may include cards just received. When every required return is complete, play starts automatically with Scum leading and no 3 of Clubs opening requirement.

## Room lifecycle

Rooms progress through:

```text
lobby -> playing -> round_complete -> exchange -> playing -> round_complete
```

Players may join and change lobby readiness only in the lobby. Next-round readiness is available only at `round_complete`. The host may remove another player during the lobby, results, exchange, or game. Host ownership migrates deterministically when the host leaves or expires.

If room membership changes during `exchange`, the prepared hands are discarded, the previous result snapshot is preserved, and remaining players return to `round_complete` with readiness cleared.

## Demo mode

Stage 3 visual prototypes remain isolated from real rooms:

```text
/?demo=1&screen=lobby
/?demo=1&screen=game
/?demo=1&screen=results
```

## Setup and testing

Requires Node.js 24 and npm.

```bash
npm install
npm run dev
npm test
```

Visit `http://localhost:3000`. The health endpoint is `http://localhost:3000/health`.

The project uses semantic HTML, mobile-first CSS, browser ES modules, Express, Socket.IO, and Node's built-in test runner. There is no frontend build step or external testing framework.

Documentation:

- [`docs/PRESIDENT_RULES.md`](docs/PRESIDENT_RULES.md)
- [`docs/ROOM_SYSTEM.md`](docs/ROOM_SYSTEM.md)
- [`docs/GAMEPLAY_SYSTEM.md`](docs/GAMEPLAY_SYSTEM.md)
- [`docs/EXCHANGE_SYSTEM.md`](docs/EXCHANGE_SYSTEM.md)
