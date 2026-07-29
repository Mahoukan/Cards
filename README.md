# President

A mobile-first foundation for an online President card game designed for private groups.

## Status

Stage 2 is complete: the project includes a documented, isolated President rules engine with deterministic deck utilities, legal-play validation, immutable single-round state transitions, role assignment, exchange planning, and automated tests.

Rooms and multiplayer integration are not implemented yet. The rules engine is intentionally not connected to Express, Socket.IO, or the browser interface.

## Technology

- HTML
- CSS
- Vanilla browser JavaScript using ES modules
- Node.js 24
- Express
- Socket.IO
- nodemon for local development
- GitHub and Railway for future source hosting and deployment

## Requirements

- Node.js 24
- npm

If you use nvm, run `nvm use` from the project directory.

## Installation

```bash
npm install
```

## Local development

Start the server with automatic restarts:

```bash
npm run dev
```

Then visit `http://localhost:3000`. The health check is available at `http://localhost:3000/health`.

## Tests

Run the complete rules-engine test suite with Node's built-in test runner:

```bash
npm test
```

No external testing framework is required.

## Production

Start the production server:

```bash
npm start
```

The server uses the `PORT` environment variable when provided and otherwise listens on port 3000.

## Folder structure

```text
card-game-place/
├── public/
│   ├── assets/
│   │   └── cards/
│   │       └── .gitkeep
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── index.html
├── src/
│   ├── game/
│   │   ├── constants.js
│   │   ├── deck.js
│   │   ├── gameEngine.js
│   │   ├── index.js
│   │   ├── roles.js
│   │   └── rules.js
│   └── rooms/
│       └── .gitkeep
├── docs/
│   └── PRESIDENT_RULES.md
├── tests/
│   └── game/
│       ├── deck.test.js
│       ├── gameEngine.test.js
│       ├── roles.test.js
│       └── rules.test.js
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

The agreed rules are documented in `docs/PRESIDENT_RULES.md`. Room creation, joining, and multiplayer integration will be added in later stages.
