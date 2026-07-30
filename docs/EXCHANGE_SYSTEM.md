# Exchange system

Production hardening: returns accept at most two bounded card IDs and never accept card objects, roles, identities, or deadlines. Private exchanged cards are excluded from logs. Return stays disabled while offline or pending.

## Next-round readiness

When a round completes, every remaining room player's `nextRoundReady` flag is false. A player may toggle their own readiness with `round:setReady` only while the room is `round_complete`.

The next round is prepared automatically when at least two current room players remain, every current player is connected, and every current player is ready. Duplicate readiness messages cannot prepare duplicate rounds because preparation requires `round_complete` and a missing exchange session.

## Role recalculation

The previous complete finish order is filtered to current room members. Relative order is preserved, then `assignRoles` is run again for the remaining player count. Historical results are not edited when someone leaves after completion.

The recalculated Scum is stored as the next starter. Round 1 starts with the 3 of Clubs holder; Round 2 and later start with Scum and do not require 3 of Clubs in the opening play.

## Preparation and automatic transfers

The coordinator creates a fresh server-dealt prepared round, increments the round number, sets `openingPlayRequired` to false, and enters `exchange`. No turn timer runs during exchange.

Required lower-role transfers happen immediately on the server:

- Scum gives their two highest cards to President.
- With four to six current players, Vice Scum gives their highest card to Vice President.

Highest-card selection uses rank order first and suit order only as a deterministic tie-breaker. Jokers rank above twos, with red above black only for stable selection, so automatic transfers may include either or both jokers. Every transfer is recorded internally, affected hands are sorted, and the prepared round is checked for exactly 54 unique cards.

## Personalised exchange views

Each connected player receives a private `exchange:update` view. The controlled player sees their own prepared hand, role, connection/host state, and any exchange instructions relevant to them.

Higher-role players see the cards they received, the lower-role player they must return to, and the exact return count. Lower-role players see their own hand after automatic cards were removed and the cards they gave. Citizens see only their own hand and waiting state.

Exchange views never include opponent prepared hands, reconnect tokens, socket IDs, complete internal round state, timer handles, maps, or unrelated exchanged card identities.

## Return validation

Higher-role players submit `exchange:returnCards` with only `{ cardIds }`. The server derives room, player, role, recipient, and required quantity from the socket-controlled session.

Rejected returns include machine-readable errors such as `NOT_IN_EXCHANGE`, `NO_EXCHANGE_REQUIRED`, `EXCHANGE_ALREADY_COMPLETE`, `WRONG_RETURN_CARD_COUNT`, `DUPLICATE_CARD`, `CARD_NOT_OWNED`, and `INVALID_CARD_SELECTION`. Invalid actions do not move cards, mark exchanges complete, increase revision, or start the round.

President may return any two owned cards. Vice President may return any one owned card. Mixed ranks are legal, returned cards may include cards just received, and a joker may be returned. Every transition preserves all 54 unique cards.

## Completion

The President and Vice President exchanges may complete in either order. After each valid return, selected cards move to the lower-role player, both hands are sorted, the exchange revision increases, and fresh personalised views are sent.

When every required exchange is complete, the coordinator confirms the prepared participants still exist, installs the prepared round as the active game session, clears exchange-only state, sets the room to `playing`, creates the first 30-second timer, and emits personalised game views. Scum leads immediately.

## Reconnection and membership changes

Resuming during exchange restores the prepared hand, role, completed exchange progress, and current instructions. It does not redeal, reapply automatic transfers, reset returns, or start a timer.

If any participant leaves, is kicked, or expires during exchange, the exchange is cancelled. Prepared hands are discarded, the previous completed result snapshot is preserved, the room returns to `round_complete`, and every remaining player must ready again. A later preparation uses only the then-current room members and a newly shuffled deck.

Rooms, active games, and prepared exchanges are in memory only and disappear after server restart or redeployment.
