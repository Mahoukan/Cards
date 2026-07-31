# Mahjong scoring foundation

The isolated engine recognises a standard hand (four melds and one pair),
Seven Pairs, and Thirteen Orphans. Chows are consecutive suited tiles; Pungs
and Kongs may use suited or honour tiles. Bonus tiles never participate in
hand structure. Existing exposed melds reduce the number of concealed melds
the solver must find, and a Kong counts as one meld.

Solving compares canonical `faceId` values while retaining physical tile IDs
in returned decompositions. It rejects duplicate IDs, bonus tiles in the
playable hand, more than four copies of a face, malformed melds, and tile
counts inconsistent with exposed melds. Waiting-tile detection tries each
available playable face without creating a fifth copy.

## Initial configurable fan table

| Pattern | Fan |
| --- | ---: |
| Standard hand | 0 |
| Seven Pairs | 4 |
| Thirteen Orphans | 13 |
| All Pungs | 3 |
| Half Flush | 3 |
| Full Flush | 7 |
| Fully concealed | 1 |
| Self-draw | 1 |
| Kong replacement, robbed added Kong, or final live-wall tile | 1 each |
| Each dragon set | 1 |
| Seat wind set | 1 |
| Prevailing wind set | 1 |
| Matching seat flower or season | 1 each |
| Complete flowers or seasons | 2 each |
| All eight bonus tiles | 4 additional |

The minimum is 3 fan and there is no cap. Full Flush and Half Flush are
exclusive. Seven Pairs can combine with flush, concealment, winning-method,
and bonus fan but not All Pungs. Thirteen Orphans combines only with
concealment, winning-method, and bonus fan. A wind matching both seat and
prevailing wind scores both items.

## Payments and declarations

Base payment is `2 ^ fan`. For a discard or robbed-Kong win, only the
responsible player pays one base payment. For self-draw, Kong replacement, or
a final live-wall draw, every opponent pays one base payment. Returned player
deltas are zero-sum.

Declaration evaluation distinguishes incomplete structure, invalid counts,
invalid exposed melds, impossible face counts, and a complete hand below the
3-fan minimum. The false-Mahjong policy is a current-round forfeit. Live play
preserves the other active players where practical, keeps the reason private,
and applies no additional point penalty.

Scoring values are central immutable configuration and may be refined. Riichi,
Dora, Furiten, Japanese Yaku, American card hands, jokers, generic Kong fan,
multiple discard winners, and additional false-declaration penalties are
intentionally excluded.
