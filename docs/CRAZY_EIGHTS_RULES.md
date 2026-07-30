# Crazy Eights rules

Crazy Eights is currently an isolated rules engine with player instructions. It is not connected to live rooms, Socket.IO, browser gameplay, or the server turn timer.

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

The engine provides a deterministic timeout operation for later multiplayer integration. It draws one card where possible, always keeps it, and ends the turn. It never automatically plays a playable drawn card. If a drawn-card decision is already open, timeout keeps that card and advances.

## Excluded house rules

The initial version does not include jokers, draw twos, skip cards, reverse cards, penalty stacking, multiple-card plays, jump-ins, teams, or match scoring.

## Implementation boundary

The engine uses plain serialisable state under `src/games/crazyEights/`. It contains no Express, Socket.IO, DOM, room, reconnect, host, or timer-handle dependencies. Normal invalid actions return structured validation results without mutating state.
