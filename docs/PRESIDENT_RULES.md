# President rules

This document is the authoritative rules specification for the isolated game engine.

## Server-enforced system actions

Normal player actions remain `playCards` and `passTurn`. Multiplayer coordination adds two server-only operations without weakening normal validation:

- `timeoutTurn` treats an expired active-pile turn as a pass. On an empty pile it normally advances without changing the timed-out hand or passed state. During the required Round 1 opening, it instead plays exactly the 3 of Clubs through normal authoritative play validation.
- `forfeitPlayer` removes an unfinished player's cards and active-turn eligibility. The first forfeit reserves the worst remaining position; later forfeits reserve progressively higher positions. Finished players retain their earned positions.

Forfeited players are appended to final standings in reverse forfeit order after normal finishers. These operations are invoked only by the authoritative server timer and room lifecycle.

## Players and deck

- A round supports two to six players.
- A 54-card deck is used: 52 standard cards, one black joker, and one red joker.
- Every card is dealt, one at a time in player order.
- When 54 is not divisible evenly, earlier players receive one more card.
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

## Opening rounds

In Round 1, the player holding the 3 of Clubs takes the first turn. Their first successful play must include that card. It may be played alone or as part of a pair, triple, or four of a kind. This restriction ends after the first successful play.

If that opening player times out, the server automatically plays the 3 of Clubs alone. The player is not marked passed, and normal finishing and turn-order rules apply. Round creation rejects an opening state whose starting player does not hold the required card.

In Round 2 and later, Scum from the recalculated current-room roles starts. The opening pile is empty, `openingPlayRequired` is false, and the first play does not need to contain the 3 of Clubs.

A joker cannot replace the required 3 of Clubs opening play in Round 1. In later rounds, Scum may lead a joker.

## Legal plays

- A play contains one to four cards of the same rank.
- An empty pile may be started with any single, pair, triple, or four of a kind, subject to the opening rule.
- An active pile must be answered with the same number of cards.
- The answering rank must be strictly higher than the active rank.
- Equal and lower ranks are illegal.
- Suits never break ties or otherwise affect legality.

## Jokers

- A joker must be played alone; two jokers or a joker plus a normal card are illegal.
- A standalone joker beats any active normal single, pair, triple, or four of a kind.
- A joker led on an empty pile is also legal outside the Round 1 opening restriction.
- A successful joker immediately clears the pile and resets passed players.
- The joker player leads again if they retain cards. If it was their final card, they finish normally and the next unfinished player leads.
- Playing a joker finishes only the player whose hand became empty; normal round-completion rules still apply.
- Black and red jokers are equivalent in gameplay. Red sorts above black only for deterministic sorting and exchanges.

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

## Tens: Higher or Lower

Every play of one or more tens requires a `higher` or `lower` choice. Quantity matching remains unchanged. The choice targets only the next eligible player's turn: outside Consecutive, Higher permits any matching higher rank and Lower permits any matching lower rank.

The override expires when its target successfully plays, passes, times out, or forfeits while current. Rejected and stale actions do not consume it. The following player compares normally against the card actually played: `10 Lower → 3 → 5` is legal. A targeted player may always use a standalone joker, which clears the override and pile.

## Consecutive

The player completing three exactly ascending, same-quantity normal plays on the current pile may call Consecutive. Jokers, quantity changes, skipped ranks, descending ranks, and cleared-pile history do not qualify.

While active, each normal play must match quantity and be exactly one rank higher. Progression follows `3` through `2`; a valid 2 after Ace clears the pile. Passing does not end Consecutive, but any pile clear resets it and its history.

A ten still requires Higher or Lower. Higher requires exactly Jack next; Lower requires exactly 9 next. The override lasts for that one target, then upward progression resumes from the card actually played. Thus `9 → 10 Lower → 9 → 10 Higher → J → Q` is legal. If the Lower target passes or times out, the unchanged ten remains on top and the following player must play Jack.

Jokers take precedence over direction, quantity, and the required Consecutive rank. They retain their existing standalone clear behavior and reset Consecutive, history, and any pending override.

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

The game coordinator executes required exchanges before Round 2 and later.

- Scum gives their two highest cards to President.
- President later returns any two cards.
- With four to six players, Vice Scum gives their highest card to Vice President.
- Vice President later returns any one card.
- With two or three players, only President and Scum exchange.
- Scum begins the next round after exchanges.
- President and Vice President may return any cards they currently hold, including cards they just received.
- Jokers rank above twos for automatic exchange selection and may be returned by a higher-role player.
- Returned cards must be unique, owned by the returning player, and match the exact required quantity.

Highest-card selection uses gameplay rank first. Tied ranks use `clubs, diamonds, hearts, spades` as an ascending deterministic suit order. This ordering exists only for deterministic selection and never affects play legality.

## Explicitly excluded variants

The engine does not implement revolution, suit ranking, equal-rank skips, transparent eights, straights, sequences, bombs, or four-of-a-kind clearing.

Rooms, networking, timers, reconnection, lobby behaviour, browser controls, accounts, databases, and matchmaking are outside this engine.

## Engine assumptions

- A configured round deck contains exactly 54 uniquely identified cards and includes the 3 of Clubs and both jokers.
- Player IDs are unique strings and remain stable during a round.
- Illegal player actions return validation results and leave the supplied state untouched.
- Invalid game construction is a programmer error and throws a descriptive exception.
- State and card objects contain data only and can be serialised as JSON.
