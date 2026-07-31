# Real-device mobile testing

Record device, OS/browser version, deployment version, network, result, and screenshots for failures.

## Device and layout

- [ ] iPhone Safari and Android Chrome, portrait and landscape
- [ ] 320 × 568, 360 × 640, 375 × 667, 390 × 844, and 430 × 932 viewports
- [ ] Desktop at narrow and wide widths
- [ ] Browser text zoom and reduced motion
- [ ] Six-player lobby, five opponents, and six-player results
- [ ] Large starting hand scrolls to both ends; lifted selections remain visible
- [ ] At 320px, gameplay and exchange selections reserve lift headroom and are not clipped at the top
- [ ] Large President exchange keeps quantity and Return reachable
- [ ] On-screen keyboard does not permanently cover forms
- [ ] No unintended page-width scroll; dialogs remain inside the viewport
- [ ] How to Play opens from home, lobby, game menu, exchange, results, and relevant demo screens at 320px
- [ ] Instructions scroll vertically, Escape and Close work, and focus returns to the opening control

## Touch and accessibility

- [ ] Primary controls are approximately 44 CSS pixels high
- [ ] Hand scrolling does not routinely select cards
- [ ] Fast double taps do not duplicate Play, Pass, Ready, or Return
- [ ] Selection and player states do not rely on colour alone
- [ ] Rank/suit text and visible keyboard focus remain available
- [ ] Menu backdrop blocks content and focus returns when it closes
- [ ] Connection, error, turn, ready, result, and exchange messages are concise
- [ ] The timer is not announced every second
- [ ] The instruction warning explains that the timer continues; live state updates remain ready underneath
- [ ] Selecting tens reveals large Higher/Lower controls, requires one choice, and shows selection without relying on colour
- [ ] Call Consecutive appears only for a qualifying selected play and active exact-rank guidance remains readable

## Card artwork

- [ ] Every rank from Ace through King and all four suits display from SVG assets
- [ ] Hearts and diamonds appear red; clubs and spades appear black
- [ ] No card is stretched or cropped at any supported viewport
- [ ] A deliberately missing image falls back to the text face without a broken-image icon
- [ ] Large hands remain horizontally scrollable to both ends
- [ ] Selected cards remain obvious through their lifted position and selected state
- [ ] Black and red joker images render with accessible text fallback
- [ ] Selecting a joker replaces normal gameplay selection; exchange selection still permits mixed cards
- [ ] Pair, triple, and four-card piles remain recognisable and compact
- [ ] The prepared exchange hand and visible received/given cards remain usable
- [ ] Slow image loading does not block selection, gameplay, or the text fallback

## Recovery and networks

- [ ] Lock/unlock, app switch, and slow connection
- [ ] Wi-Fi to mobile-data transition and back
- [ ] Last authoritative screen stays visible and mutations disable offline
- [ ] Refresh during lobby, gameplay, exchange, and results
- [ ] Shared-session tab replacement leaves the replacement session stored
- [ ] Railway redeployment resets rooms and produces an expired-session message

## Multiplayer behavior

- [ ] Invite link and code join
- [ ] Turn timeout
- [ ] Round 1 opening timeout publicly plays only the 3 of Clubs, starts one fresh timer, and play continues
- [ ] `10 Lower → 3 → 5` consumes the override once and resumes ordinary higher play
- [ ] `9 → 10 Lower → 9 → 10 Higher → J → Q` displays each required step correctly
- [ ] Pass, timeout, and current-player removal consume a targeted ten override
- [ ] Joker and legal 2 clears remove Consecutive, direction, and sequence indicators
- [ ] Refresh/reconnect preserves a pending override, Consecutive indicator, and unchanged deadline
- [ ] Create President and Crazy Eights from separate home cards; join-by-code routes to the stored game
- [ ] Crazy Eights at 320px keeps top card, active suit, timer, hand, and controls reachable without horizontal page scroll
- [ ] Crazy Eights opponents show card counts but never card faces
- [ ] Selecting a different card replaces selection; unplayable cards remain identifiable
- [ ] An 8 requires one visibly selected suit choice using text and symbol
- [ ] A playable draw enables only Play Drawn Card and Keep Card; an unplayable draw advances automatically
- [ ] Crazy Eights timeout draws and keeps at most one card, advances once, and shows a public message
- [ ] Refresh during normal and drawn-card-decision turns restores the hand and unchanged deadline
- [ ] Winner, remaining counts, readiness list, and fresh replay deal render correctly
- [ ] Host kick and host migration
- [ ] Session replacement
- [ ] Leaving during exchange
- [ ] Forfeit and six-player room behavior
- [ ] Multiple rounds, exchange, and later-round Scum start
- [ ] Joker clears single/pair piles immediately, starts one fresh timer, and returns the lead correctly
- [ ] Final-card joker finishes only its player; Round 1 still requires 3♣
