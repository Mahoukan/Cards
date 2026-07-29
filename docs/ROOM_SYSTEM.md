# Room system

Production hardening: socket payloads are plain-object validated, unknown fields are discarded, strings are bounded, and ready values must be booleans. Mutating events use per-socket throttling and guarded acknowledgements. Only reconnect credentials are stored in the browser. Rooms remain in memory and reset on restart.

## Lifecycle

`RoomManager` owns in-memory room objects. Rooms progress through `lobby`, `playing`, `round_complete`, and `exchange`:

```text
lobby -> playing -> round_complete -> exchange -> playing
```

Creating a room adds its host. Joining is allowed only in `lobby`. Empty rooms are deleted. Scheduling, time, ID generation, token generation, and randomness are injectable for deterministic tests.

Lobby readiness uses `ready` and is accepted only in `lobby`. Next-round readiness uses `nextRoundReady` and is accepted only in `round_complete`. Disconnecting clears both readiness flags for that player. Any participant removal during results or exchange clears next-round readiness for the remaining room members.

## Removal

Voluntary leave and host kick remove seats immediately. During `playing`, removal invokes the game coordinator first so an unfinished player forfeits before their room seat and reconnect credential are removed.

During `round_complete`, removal preserves the completed result snapshot and clears next-round readiness. During `exchange`, removal aborts the prepared exchange, discards prepared hands, returns the room to `round_complete`, and clears readiness. Remaining players must ready again before a newly shuffled next round is prepared.

## Socket events

Client requests use acknowledgement responses with either `{ ok: true, ... }` or `{ ok: false, error }`.

| Event | Direction | Purpose |
| --- | --- | --- |
| `room:create` | client -> server | Create a room and host session |
| `room:join` | client -> server | Join an existing lobby |
| `room:resume` | client -> server | Reclaim a seat using private credentials |
| `room:setReady` | client -> server | Change lobby readiness |
| `round:setReady` | client -> server | Change next-round readiness during results |
| `room:kick` | client -> server | Host removes another player |
| `room:leave` | client -> server | Remove the controlled player immediately |
| `room:update` | server -> room | Broadcast the latest public room view |
| `room:kicked` | server -> client | Notify a removed player |
| `room:sessionReplaced` | server -> client | Notify an older socket that a newer socket took control |
| `room:readyToStart` | server -> room | Announce the lobby ready transition |

Successful resume acknowledgements include a personalised `game` view while playing or showing results, and a personalised `exchange` view while exchanging.

## Public and private data

Public room views include the room code/status, capacity, lobby readiness, next-round readiness, host player ID, and sanitized player identity/status fields. They never include reconnect tokens, socket IDs, prepared hands, timer handles, maps, or internal lookup keys.

Successful create, join, and resume acknowledgements privately return that browser's room code, player ID, and reconnect token. The token is generated with Node's `crypto` module and is never included in a URL or room broadcast.

## Reconnection and replacement

The browser stores its active session in local storage. On Socket.IO connection it submits all three credential fields to `room:resume`. A matching token rebinds the seat. The newest valid resume replaces any previous controlling socket; the previous socket is notified, removed from the Socket.IO room, and cannot perform further room actions.

Resuming during `round_complete` restores the real results screen and current next-round readiness. Resuming during `exchange` restores the personalised prepared hand and exchange instructions without redealing, reapplying automatic transfers, or starting a timer.

## Host migration

The creator is the first host. Host disconnection alone does not migrate ownership. When a host leaves, is kicked by cleanup, or reaches grace-period expiry, the manager selects the earliest joined connected player, falling back to the earliest joined remaining player.

## Limitations

Rooms, active rounds, results, and prepared exchanges exist in a single Node.js process and are not persisted or shared across instances. Restarts and redeployments remove them. There is no cross-instance coordination, account identity, public matchmaking, or durable match history.
