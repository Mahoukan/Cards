# President

A mobile-first President card game for private groups.

## Status

Stage 3 is complete: the browser now includes a polished, local interface prototype backed by deterministic mock data. The isolated server rules engine remains authoritative and fully tested, but it is **not connected to the interface yet**. Multiplayer rooms, accounts, persistence, matchmaking, and real room Socket.IO events are not implemented.

The Socket.IO connection indicator reports server availability only. Create, join, ready, remove, play, and pass actions change local mock state and do not contact the server.

## Prototype screens

- Home
- Create room
- Join room
- Lobby
- Active game
- Round results

Open a screen directly for review:

```text
/?screen=home
/?screen=create
/?screen=join
/?screen=lobby
/?screen=game
/?screen=results
```

Unknown screen values safely show Home. Normal interface buttons also navigate between screens.

## Design target

The interface is designed mobile-first for portrait phone widths from 320px through 430px, with safe-area padding, touch controls, accessible status messaging, keyboard focus states, and a constrained desktop layout. Cards use an asset-independent CSS/text renderer because no card images are currently present.

## Technology

- Semantic HTML and mobile-first CSS
- Vanilla browser JavaScript using ES modules
- Node.js 24 and its built-in test runner
- Express and Socket.IO

No frontend framework or build step is used.

## Setup and development

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

Run the complete rules-engine and browser-utility suite:

```bash
npm test
```

Browser utility tests cover display-name and room-code handling, selection compatibility, hand layout, counts, and timer formatting. No DOM testing dependency is required.

The President rules are documented in [`docs/PRESIDENT_RULES.md`](docs/PRESIDENT_RULES.md).
