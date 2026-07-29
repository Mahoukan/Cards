# President

A mobile-first, server-authoritative President card game for private groups.

## Status

Stage 5 connects the tested President engine to real Socket.IO rooms for one complete multiplayer round. Ready lobbies start automatically, the server shuffles and deals private hands, validates plays and passes, owns 30-second turns, handles forfeits, and produces real finishing roles.

Not implemented yet: rematches, next-round exchanges, consecutive rounds, accounts, persistence, matchmaking, chat, spectators, or bots.

Rooms and active games exist only in one server process. A restart or Railway redeployment removes all rooms and games.

## Playing

Create a room and share its four-character code or invite URL:

```text
/?room=ABCD
```

When every connected player is ready and at least two players are present, the server starts the round immediately. The player holding 3♣ opens. The server sends each browser its own hand and only card counts for opponents.

Each turn has an absolute 30-second server deadline. A timeout passes on an active pile or skips the leader on an empty pile. The browser countdown is display-only.

The original browser stores a private reconnect credential under `president.activeRoomSession`. Refreshing or reconnecting within 60 seconds restores the same seat and hand without resetting the turn deadline. Leaving, being kicked, or exceeding the grace period forfeits an unfinished round.

## Room lifecycle

Rooms progress through:

```text
lobby → playing → round_complete
```

Players may join and change readiness only in the lobby. The host may remove another player during the lobby or game. Host ownership migrates deterministically when the host leaves or expires.

After round completion, real finishing positions and roles are displayed. Rematch and card-exchange actions intentionally remain unavailable.

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
