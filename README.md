# President

A mobile-first President card game for private groups.

## Status

Stage 4 adds real, server-authoritative private rooms and live Socket.IO lobbies. Players can create or join a room, share its code, toggle readiness, reconnect from the original browser, leave, and be removed by the host. Host migration and disconnected-player cleanup are handled by the server.

Real card gameplay is **not connected yet**. The President rules engine remains isolated and authoritative; dealing, playing, passing, timers, results, and exchanges will be integrated in Stage 5.

## Private rooms

Room codes contain four unambiguous uppercase letters or numbers. Create Room generates a new code; Join Room accepts a code from another player. Invite links use:

```text
/?room=ABCD
```

The link opens the Join screen and prefills the code. It does not contain private credentials or submit automatically.

Rooms are stored only in server memory. A server restart, Railway restart, or redeployment removes every active room.

## Reconnection and lobby rules

The browser stores a private room session in local storage under `president.activeRoomSession`. It contains a stable player ID and private reconnect token. On reconnection or refresh, the browser presents that credential to reclaim its original seat; a display name or room code alone cannot reclaim a seat.

- A disconnected player keeps their seat for 60 seconds.
- Disconnecting clears that player's ready state.
- Disconnected seats count toward the six-player limit and prevent the lobby becoming ready.
- The host remains host throughout their grace period.
- When a host leaves or expires, the earliest joined connected player becomes host; if all are disconnected, the earliest joined player is chosen.
- The host may remove another player immediately.
- A lobby is ready only with at least two players and when every player is connected and ready.

Ready lobbies remain in the lobby until real game integration arrives.

## Interface and demo screens

Normal Home, Create, Join, and Lobby screens use live room communication. Stage 3 visual prototypes remain available only in demo mode:

```text
/?demo=1&screen=lobby
/?demo=1&screen=game
/?demo=1&screen=results
```

The interface targets portrait phone widths from 320px through 430px, supports safe areas and touch controls, and remains constrained on desktop.

## Setup

Requires Node.js 24 and npm.

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. The health endpoint is `http://localhost:3000/health`.

For production-style local startup:

```bash
npm start
```

The server uses `PORT` when provided, otherwise port 3000.

## Testing

Run the rules-engine, browser-utility, validation, room-code, and room-manager tests:

```bash
npm test
```

The project uses Node's built-in test runner and has no browser build step or external testing framework.

Further documentation:

- [`docs/PRESIDENT_RULES.md`](docs/PRESIDENT_RULES.md)
- [`docs/ROOM_SYSTEM.md`](docs/ROOM_SYSTEM.md)
