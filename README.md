# President

President is a complete, mobile-first, in-memory multiplayer MVP for private games with 2–6 friends. It includes private rooms, reconnectable sessions, host migration, server-authoritative rounds and timers, forfeits, role exchanges, and consecutive rounds.

The production MVP is ready for external phone testing. It remains deliberately focused on one game and has no accounts, public matchmaking, chat, bots, analytics, or stored match history. Rooms and active games are not persistent: a server restart or Railway redeployment ends them.

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm

## Commands

```bash
npm install
npm run dev
npm test
npm run test:smoke
npm start
```

`npm start` serves the browser client and Socket.IO from the same HTTP service. Health probes are available at `/health`; readiness is at `/ready`.

## Configuration

Configuration is read and validated centrally. `.env.example` is a safe reference; Node does not load `.env` files automatically and no dotenv package is required.

| Variable | Default | Purpose |
|---|---:|---|
| `NODE_ENV` | `development` | Use `production` on Railway; enables one-layer proxy trust. |
| `PORT` | `3000` | HTTP and Socket.IO port. Railway supplies this. |
| `PUBLIC_ORIGIN` | unset | Optional exact CORS origin. Leave unset for normal same-origin deployment. |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug`, or `silent`. |
| `ROOM_RECONNECT_GRACE_MS` | `60000` | Time before a disconnected player is removed. |
| `TURN_DURATION_MS` | `30000` | Server-authoritative turn duration. |
| `SOCKET_ACTION_LIMIT` | `30` | Mutating requests allowed per socket window. |
| `SOCKET_ACTION_WINDOW_MS` | `10000` | Per-socket throttling window. |

Invalid numeric values fail startup with a clear server-side error. Environment values are not exposed to the browser.

## Documentation

- [Room system](docs/ROOM_SYSTEM.md)
- [Gameplay system](docs/GAMEPLAY_SYSTEM.md)
- [Exchange system](docs/EXCHANGE_SYSTEM.md)
- [President rules](docs/PRESIDENT_RULES.md)
- [Railway deployment](docs/DEPLOYMENT.md)
- [Real-device mobile checklist](docs/MOBILE_TESTING.md)

Card artwork is optional. `public/assets/cards/` currently uses the accessible text/CSS fallback; future local assets may be placed there once a stable naming convention is chosen.
