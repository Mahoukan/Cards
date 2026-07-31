# Railway deployment

The single Node service serves both President and Crazy Eights. No additional process, dependency, port, database, or environment variable is required. Rooms store their game ID in memory and both games share the reconnect grace period, turn duration, origin policy, and socket action limiter.

Crazy Eights uses the same static card assets and Socket.IO endpoint. As with President, active rooms, hands, reconnect sessions, results, and game selection disappear when the process restarts or redeploys.

## Prerequisites and setup

1. Push this Node 24 repository to GitHub.
2. In Railway, create a project, choose **Deploy from GitHub repo**, and select the production branch.
3. Set `NODE_ENV=production`. Leave Railway's generated `PORT` unchanged.
4. Use no build command (or `npm install` if Railway asks) and use `npm start` as the start command.
5. Generate a Railway public domain for the service.

No other variable is required. Express and Socket.IO share one service and origin. `PUBLIC_ORIGIN` is optional and should normally remain unset. Set it only for an intentional separate browser origin; it must be an exact HTTP(S) origin and becomes the only Socket.IO CORS origin.

Optional overrides are `LOG_LEVEL`, `ROOM_RECONNECT_GRACE_MS`, `TURN_DURATION_MS`, `SOCKET_ACTION_LIMIT`, and `SOCKET_ACTION_WINDOW_MS`. Invalid values stop startup. Do not hard-code a Railway domain.

## First deployment verification

1. Confirm `/health` returns HTTP 200 and `{"status":"ok"}`.
2. Confirm `/ready` returns HTTP 200 and `{"status":"ready"}`.
3. On two independent phones or private contexts, create, join, ready, make the opening play, refresh one client, and confirm its identity and hand return.
4. Inspect Railway logs for structured server, socket, room, and round events.

Logs omit reconnect tokens, full hands/decks, and private exchange cards. Client addresses are temporary lifecycle context only, are not authentication, and are never sent to browsers.

## Redeploy, rollback, and limitations

Railway sends a termination signal during deployment. The service marks readiness unavailable, stops traffic, closes Socket.IO/HTTP, and clears its timers. Use Railway deployment history to select a known-good deployment and choose **Redeploy** for rollback.

There is no database, Redis, or persistent filesystem state. Every restart, redeploy, crash, scale-to-zero event, or rollback ends active rooms and games. Graceful shutdown prevents hanging; it does not preserve games.
