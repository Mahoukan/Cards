# Card Table

President and Crazy Eights are available in private multiplayer rooms. Crazy Eights uses a standard 52-card deck without jokers and supports live turns, wild-suit choices, one-card drawing, reconnect, results, and replay.

President is a complete, mobile-first, in-memory multiplayer MVP for private games with 2–6 friends. It includes a 54-card deck with two jokers, private rooms, reconnectable sessions, host migration, server-authoritative rounds and timers, forfeits, role exchanges, and consecutive rounds.

The production MVP is ready for external phone testing. It remains deliberately focused on one game and has no accounts, public matchmaking, chat, bots, analytics, or stored match history. Rooms and active games are not persistent: a server restart or Railway redeployment ends them.

President house rules include a required Higher/Lower choice whenever tens are played; that direction affects only the next eligible player's turn. Players completing three exactly ascending, same-sized plays may also call Consecutive, which requires exact upward ranks until the pile clears. A temporary Lower step resumes upward from the card actually played, while jokers retain precedence and clear all special state.

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
- [Crazy Eights rules](docs/CRAZY_EIGHTS_RULES.md)
- [Card assets](docs/CARD_ASSETS.md)
- [Railway deployment](docs/DEPLOYMENT.md)
- [Real-device mobile checklist](docs/MOBILE_TESTING.md)

SVG playing-card artwork is integrated through the shared card renderer. Assets live in `public/assets/cards/` and standard cards use the engine-ID convention `<rank>-<suit>.svg`, such as `10-diamonds.svg` or `Q-clubs.svg`. Ranks are `A`, `2`–`10`, `J`, `Q`, and `K`; suits are `clubs`, `diamonds`, `hearts`, and `spades`.

The accessible CSS/text face remains in every rendered card and appears automatically if an image is missing, blocked, or fails to load. `joker-black.svg` and `joker-red.svg` are active game cards: each is played alone, beats any active quantity, and immediately clears the pile. Selectable hands reserve lift headroom so selected cards remain visible while horizontal scrolling continues to work.

Create either game from its home-screen card, or join any room by code—the stored room game selects the correct lobby and table automatically. Use **How to Play** from either game card or live screen. The shared catalog owns public metadata, and `/?instructions=president` and `/?instructions=crazy-eights` open the corresponding rules directly.
