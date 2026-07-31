# Mahjong rules

Mahjong supports 2–4 players and always uses all 144 tiles: four copies of
Characters 1–9, Dots 1–9, Bamboo 1–9, four winds and three dragons, plus one
each of four seasons and four flowers. Standard play is primarily for four
players; unused winds remain in the wall with fewer players.

A player explicitly declares Mahjong with a legal hand worth at least 3 fan.
A normal hand is four melds and a pair; Seven Pairs and Thirteen Orphans are
allowed. East starts with 14 playable tiles and discards first. Others start
with 13, then normally draw and discard one tile.

A Chow is three consecutive suited tiles and only the next player may claim
it. A Pung is three identical tiles and any player may claim. Concealed,
discard, and added Kongs are allowed. Kong replacements come from the dead
wall, which is replenished from the live wall. An added Kong can be robbed.
Claim priority is Mahjong, Pung/Kong, Chow, with 10 seconds to claim. Equal
claims go to the closest eligible player; multiple discard winners are barred.

The dead wall begins with 14 tiles. Normal draws use the live wall. Kongs and
bonus tiles use dead-wall replacements followed by live-wall replenishment.
Bonus tiles are immediately exposed and do not count in the concealed hand.
Live-wall exhaustion draws the round.

Seat mappings are: 1 East/Spring/Plum; 2 South/Summer/Orchid; 3
West/Autumn/Chrysanthemum; 4 North/Winter/Bamboo flower. Prevailing wind is
independent of player count.

East remains dealer after an East win or draw; otherwise dealer moves
clockwise. Rotation back to original East ends the match. Simplified
traditional scoring has a 3-fan minimum and no cap. All opponents pay a
self-draw; only the discarder pays a discard win. Matching seat and prevailing
winds and matching/complete bonus collections score.

Timeout discards the most recent draw, or the rightmost concealed tile.
Disconnected players remain timed.

The isolated engine validates standard four-meld-and-pair hands, Seven Pairs,
and Thirteen Orphans. It validates exposed Chows, Pungs, and Kongs, finds claim
candidates and structurally winning tile faces, and preserves physical tile
IDs while comparing equivalent faces. Four identical tiles may form two pairs
for Seven Pairs. A Kong counts as one meld.

Simplified Hong Kong-style fan scoring is implemented with a 3-fan minimum and
no cap. Payments are `2 ^ fan`: only the responsible player pays a discard or
robbed-Kong win, while every opponent pays a self-draw, replacement-tile, or
last-live-tile win. See `MAHJONG_SCORING.md`.

A false Mahjong declaration causes that player to forfeit the current round
without an additional point penalty. The structured reason remains private.

Live rooms use stable player order for initial seats and begin at 1000 points.
East opens by discarding without drawing. Later turns automatically draw,
replace bonus tiles from the dead wall, then allow an explicit Mahjong or Kong
declaration before discard. Discards open a 10-second claim window. Priority is
Mahjong, then Pung/Kong, then Chow; equal claims go clockwise from the
discarder and only the next active player may Chow. Turn timeouts
deterministically discard the last draw or rightmost sorted tile.

East continues after an East win or draw. Otherwise East rotates clockwise and
seat winds rotate with it. A match ends after one complete dealer rotation.
Rooms preserve private hands and active deadlines across reconnects.
Spectators, Riichi/Dora/Furiten/Yaku, betting, American cards, jokers, and
multiple discard winners remain excluded.
