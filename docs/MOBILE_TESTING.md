# Real-device mobile testing

Record device, OS/browser version, deployment version, network, result, and screenshots for failures.

## Device and layout

- [ ] iPhone Safari and Android Chrome, portrait and landscape
- [ ] 320 × 568, 360 × 640, 375 × 667, 390 × 844, and 430 × 932 viewports
- [ ] Desktop at narrow and wide widths
- [ ] Browser text zoom and reduced motion
- [ ] Six-player lobby, five opponents, and six-player results
- [ ] Large starting hand scrolls to both ends; lifted selections remain visible
- [ ] Large President exchange keeps quantity and Return reachable
- [ ] On-screen keyboard does not permanently cover forms
- [ ] No unintended page-width scroll; dialogs remain inside the viewport

## Touch and accessibility

- [ ] Primary controls are approximately 44 CSS pixels high
- [ ] Hand scrolling does not routinely select cards
- [ ] Fast double taps do not duplicate Play, Pass, Ready, or Return
- [ ] Selection and player states do not rely on colour alone
- [ ] Rank/suit text and visible keyboard focus remain available
- [ ] Menu backdrop blocks content and focus returns when it closes
- [ ] Connection, error, turn, ready, result, and exchange messages are concise
- [ ] The timer is not announced every second

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
- [ ] Host kick and host migration
- [ ] Session replacement
- [ ] Leaving during exchange
- [ ] Forfeit and six-player room behavior
- [ ] Multiple rounds, exchange, and later-round Scum start

