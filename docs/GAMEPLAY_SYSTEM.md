# Gameplay system

Production hardening: Play and Pass use validated payloads, per-socket throttling, duplicate-submit locks, and acknowledgement timeouts while remaining server-authoritative. Controls disable while offline or resuming. `TURN_DURATION_MS` configures the turn timer.

## Automatic round start

`GameCoordinator.maybeStart` starts exactly once when a lobby has at least two players and every seat is connected and ready. It snapshots stable player IDs and names, creates a shuffled round through the existing engine, changes the room to `playing`, clears ready flags, and creates the first deadline.

## Hidden-information boundary

Authoritative engine state stays on the server. Each socket receives a separately constructed view containing:

- room status, round number, revision, server time, and turn deadline;
- the controlled player's complete hand and public state;
- opponent card counts, connection, pass, finish, forfeit, host, and current-turn states;
- the exact cards in only the current public play;
- a safe public joker-clear notice and joker card after an immediate clear;
- public finishing order and final results.

Views never contain another player's hand, reconnect tokens, socket IDs, discard history, removed cards, timer handles, maps, or authoritative state objects.

## Game events

| Event | Direction | Purpose |
| --- | --- | --- |
| `game:play` | client → server | Submit selected card IDs |
| `game:pass` | client → server | Pass the controlled player's active-pile turn |
| `game:update` | server → client | Send a fresh personalised view |
| `game:roundStarted` | server → client | Announce automatic start with a personalised view |
| `game:roundComplete` | server → client | Announce final results with a personalised view |

The server derives room and player identity from the controlling socket. Clients cannot submit player IDs, room codes, hands, deadlines, roles, or positions.

## Turn timer and timeouts

Each playing room has exactly one timer record with an absolute `now + 30_000` deadline, expected player, and callback handle. Successful actions reset it. Invalid actions, disconnects, and resumes do not. Callbacks verify both expected player and deadline, so stale callbacks cannot affect newer turns.

A successful joker play is one accepted action: revision increments once, the pile clears immediately, and exactly one fresh timer starts for the correct next leader. Rejected joker actions change neither revision nor deadline.

The server does not emit per-second ticks. Browsers estimate server clock offset from `serverTime` and render the deadline locally. The countdown does not enforce game state.

An active-pile timeout uses authoritative pass logic. An empty-pile timeout normally advances without marking the player passed or altering their hand. The Round 1 opening timeout is deterministic: `timeoutTurn` submits only `3-clubs` through the normal play transition. That removes and publishes the card, clears the opening requirement, advances or finishes normally, increments the revision once, and replaces the expired timer with one new timer. Corrupted opening state is rejected and logged without hand details.

## Tens and Consecutive state

Authoritative round state stores `nextPlayOverride`, `consecutiveActive`, and public-only `pilePlayHistory`. A ten requires a validated direction and targets the next eligible player. Successful play, pass, timeout, or current-player forfeit consumes that target; rejection does not. Consecutive activation validates the latest three normal same-quantity plays, then enforces an exact upward rank until the pile clears.

Jokers bypass these comparisons and clear all three fields. Twos must satisfy the active ordinary, temporary direction, or exact Consecutive comparison before their normal clear. Accepted plays—including declarations—increment once and start one timer; rejected options change neither revision nor deadline. Personalised views expose status, required rank, public direction, and whether the override applies to that viewer, never the authoritative target ID or hidden cards. Resume reconstructs this view from unchanged server state and preserves the deadline.

## Reconnection and forfeits

Disconnecting preserves the hand and active game seat for the room's 60-second grace period; turns continue and may time out. A valid token restores the same personalised hand and unchanged deadline. A newer valid socket replaces the older controller.

An unfinished player forfeits when kicked, leaving voluntarily, or expiring. Their cards are removed rather than redistributed, they leave active turn order, and they reserve the lowest remaining position. Finished players keep earned positions. Timer state resets only when a forfeit changes the current player.

## Completion

When one active unfinished player remains, the engine completes standings using normal finishers, the last active player, and forfeited players in reverse forfeit order. Existing role assignment produces President through Scum. The coordinator clears the timer, stores names and results, changes the room to `round_complete`, resets next-round readiness for remaining room players, and sends final personalised views.

## Multiple rounds

Round numbers increment when a prepared exchange becomes the next active game session. Round 1 keeps the 3 of Clubs opening requirement. Round 2 and later use the recalculated Scum as `currentPlayerId`, set `openingPlayRequired` to false, and start a normal 30-second turn timer only after every required exchange is complete.

The browser uses shared selectable-hand layout headroom equal to the card lift distance. Lifted and focused cards remain visible without disabling horizontal hand scrolling, including at 320px width.

All active state is in memory and disappears after server restart or redeployment.

## Player instructions

The reusable serialisable catalog at `public/js/games/instructions.js` owns President's player-facing instructions under the stable `president` ID. One accessible modal renders that catalog from the home, lobby, active-game menu, exchange, results, and demo versions of those screens. `/?instructions=president` is the safe direct route; invalid IDs are ignored. Opening it does not navigate, mutate the session, or interrupt incoming views, and the authoritative timer continues.
