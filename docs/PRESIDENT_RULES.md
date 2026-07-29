# President rules

This document is the authoritative rules specification for the isolated game engine.

## Server-enforced system actions

Normal player actions remain `playCards` and `passTurn`. Multiplayer coordination adds two server-only operations without weakening normal validation:

- `timeoutTurn` treats an expired active-pile turn as a pass. On an empty pile it advances to the next eligible player without changing the timed-out hand or passed state.
- `forfeitPlayer` removes an unfinished player's cards and active-turn eligibility. The first forfeit reserves the worst remaining position; later forfeits reserve progressively higher positions. Finished players retain their earned positions.

Forfeited players are appended to final standings in reverse forfeit order after normal finishers. These operations are invoked only by the authoritative server timer and room lifecycle.

## Players and deck

- A round supports two to six players.
- One standard 52-card deck is used, without jokers.
- Every card is dealt, one at a time in player order.
- When 52 is not divisible evenly, earlier players receive one more card.
- Suits have no gameplay ranking.

Cards are plain serialisable objects with stable IDs, such as:

```js
{
  id: "3-clubs",
  rank: "3",
  suit: "clubs",
  value: 0
}
```

The suit identifiers are `clubs`, `diamonds`, `hearts`, and `spades`.

## Rank order

Ranks increase in this order:

```text
3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
```

## Opening the first round

The player holding the 3 of Clubs takes the first turn. Their first successful play must include that card. It may be played alone or as part of a pair, triple, or four of a kind. This restriction ends after the first successful play.

## Legal plays

- A play contains one to four cards of the same rank.
- An empty pile may be started with any single, pair, triple, or four of a kind, subject to the opening rule.
- An active pile must be answered with the same number of cards.
- The answering rank must be strictly higher than the active rank.
- Equal and lower ranks are illegal.
- Suits never break ties or otherwise affect legality.

## Passing

- Passing is allowed only while responding to an active play.
- A player cannot pass when beginning an empty pile.
- A player who passes is excluded from turns until the pile clears.
- Finished players are always skipped.

## Clearing the pile

The pile clears when every eligible opponent of the last successful player has passed or finished. Passed players become eligible again.

The last successful player leads the new pile if they still hold cards. If they have finished, the next unfinished player after them in the original turn order leads. Turn order wraps from the last player to the first.

## Twos

A legal play of one or more twos clears the pile immediately. Twos must still match the active play's card count: a pair of twos can beat a pair but cannot answer a single.

The player who played the twos leads the new pile if they still have cards. If that play emptied their hand, the next unfinished player in turn order leads.

## Finishing and round completion

- A player finishes as soon as their hand becomes empty.
- Finish positions are recorded in order.
- Finished players take no more turns.
- When only one unfinished player remains, that player automatically receives the final position.
- The round then enters the `complete` phase.

## Roles

Roles are assigned from finish order:

| Players | Roles from first to last |
| --- | --- |
| 2 | President, Scum |
| 3 | President, Citizen, Scum |
| 4 | President, Vice President, Vice Scum, Scum |
| 5 | President, Vice President, Citizen, Vice Scum, Scum |
| 6 | President, Vice President, Citizen, Citizen, Vice Scum, Scum |

## Next-round exchanges

The Stage 2 engine describes required exchanges but does not execute an exchange state machine.

- Scum gives their two highest cards to President.
- President later returns any two cards.
- With four to six players, Vice Scum gives their highest card to Vice President.
- Vice President later returns any one card.
- With two or three players, only President and Scum exchange.
- Scum begins the next round after exchanges.

Highest-card selection uses gameplay rank first. Tied ranks use `clubs, diamonds, hearts, spades` as an ascending deterministic suit order. This ordering exists only for deterministic selection and never affects play legality.

## Explicitly excluded variants

The engine does not implement jokers, revolution, suit ranking, equal-rank skips, transparent eights, straights, sequences, bombs, or four-of-a-kind clearing.

Rooms, networking, timers, reconnection, lobby behaviour, browser controls, accounts, databases, and matchmaking are outside this engine.

## Engine assumptions

- A configured round deck contains exactly 52 uniquely identified cards and includes the 3 of Clubs.
- Player IDs are unique strings and remain stable during a round.
- Illegal player actions return validation results and leave the supplied state untouched.
- Invalid game construction is a programmer error and throws a descriptive exception.
- State and card objects contain data only and can be serialised as JSON.
