# Crazy Eights rules

Crazy Eights is playable in private 2–6 player rooms. The isolated rules engine remains authoritative while a dedicated coordinator connects it to rooms, personalised views, guarded Socket.IO actions, deadlines, reconnect, forfeits, results, and replay.

## Objective and setup

- The first player to empty their hand wins immediately.
- Two to six players use a standard 52-card deck without jokers.
- Two players receive seven cards each; three to six receive five.
- Cards are dealt one at a time in player order.
- The undealt cards form the draw pile.
- One non-eight card starts the discard pile and its suit becomes active.

## Playing

A player plays exactly one owned card on their turn. It must match the top discard's rank, match the active suit, or be an 8. Normal cards make their printed suit active.

An 8 is wild and requires a choice of clubs, diamonds, hearts, or spades. The 8 remains the physical top discard, but the chosen suit controls suit matching.

## Drawing

A player who does not initially play draws exactly one card. They cannot draw repeatedly.

- An unplayable card is kept and the turn ends automatically.
- A playable card creates a decision: play only that newly drawn card, or keep it and end the turn.
- After drawing, a different card from the original hand cannot be played.

If the draw pile is empty, the top discard stays in place and older discards are shuffled into a new draw pile. The active suit is preserved. If no older discard exists, the turn ends without drawing.

## Timeout

The engine timeout draws one card where possible, always keeps it, and ends the turn. It never automatically plays a playable drawn card. If a drawn-card decision is already open, timeout keeps that card and advances.

Live rooms use the shared server-authoritative 30-second timer. Stale callbacks are ignored. A playable manual draw keeps the existing deadline while the player decides; actions that advance the turn replace the expired timer with exactly one new deadline.

## Excluded house rules

The initial version does not include jokers, draw twos, skip cards, reverse cards, penalty stacking, multiple-card plays, jump-ins, teams, or match scoring.

## Multiplayer interface

Rooms store the immutable `crazy-eights` game ID. Clients send only `crazy-eights:play`, `crazy-eights:draw`, and `crazy-eights:keep-drawn`; the server derives room, player, legality, active suit, and decision state.

Personalised views include the controlled hand and playable flags. Public data is limited to player names and card counts, connection state, current player, top discard, active suit, pile counts, recent action, deadline, and winner. Draw-pile order, opponent cards, socket IDs, and reconnect tokens are never included.

Disconnected seats remain during the existing grace period and their timer continues. Reconnect restores the private hand, any drawn-card decision, and unchanged deadline. Permanent removal returns owned cards to the shuffled draw pile. If one active player remains, that player wins.

After completion, results show the winner and remaining card counts. Current room members can ready up to create a fresh deal and one new timer.

## Implementation boundary

The engine uses plain serialisable state under `src/games/crazyEights/` and remains independent of Express, Socket.IO, DOM, rooms, reconnect tokens, and timer handles. Coordinator, view, and socket adapter modules surround it without moving game legality into handlers.
