# Room system

## Lifecycle

`RoomManager` owns in-memory room objects. Rooms progress through `lobby`, `playing`, and `round_complete`. Creating a room adds its host; joining is allowed only in the lobby. Voluntary leave and host kick remove seats immediately. An empty room is deleted.

On disconnect, the player is marked offline and unready while their seat and host status are retained for 60 seconds. A valid resume cancels cleanup. Expiry removes the player, migrates the host when necessary, and deletes an empty room. Scheduling, time, ID generation, token generation, and randomness are injectable for deterministic tests.

During a round, removal invokes the game coordinator first so an unfinished player forfeits before their room seat and reconnect credential are removed.

## Socket events

Client requests use acknowledgement responses with either `{ ok: true, ... }` or `{ ok: false, error }`.

| Event | Direction | Purpose |
| --- | --- | --- |
| `room:create` | client → server | Create a room and host session |
| `room:join` | client → server | Join an existing lobby |
| `room:resume` | client → server | Reclaim a seat using private credentials |
| `room:setReady` | client → server | Change the controlled player's readiness |
| `room:kick` | client → server | Host removes another player |
| `room:leave` | client → server | Remove the controlled player immediately |
| `room:update` | server → room | Broadcast the latest public view |
| `room:kicked` | server → client | Notify a removed player |
| `room:sessionReplaced` | server → client | Notify an older socket that a newer socket took control |
| `room:readyToStart` | server → room | Announce the false-to-true ready transition |

Successful resume acknowledgements include a personalised `game` view while the room is playing or showing results.

## Public and private data

Public room views include the room code/status, capacity, readiness, host player ID, and sanitized player identity/status fields. They never include reconnect tokens, socket IDs, timer handles, maps, or internal lookup keys.

Successful create, join, and resume acknowledgements privately return that browser's room code, player ID, and reconnect token. The token is generated with Node's `crypto` module and is never included in a URL or room broadcast.

## Reconnection and replacement

The browser stores its active session in local storage. On Socket.IO connection it submits all three credential fields to `room:resume`. A matching token rebinds the seat and clears its ready state. The newest valid resume replaces any previous controlling socket; the previous socket is notified, removed from the Socket.IO room, and cannot perform further room actions.

## Host migration

The creator is the first host. Host disconnection alone does not migrate ownership. When a host leaves, is kicked by cleanup, or reaches grace-period expiry, the manager selects the earliest joined connected player, falling back to the earliest joined remaining player.

## Limitations

Rooms and games exist in a single Node.js process and are not persisted or shared across instances. Restarts and redeployments remove them. There is no cross-instance coordination, account identity, matchmaking, rematch, or next-round exchange yet.
