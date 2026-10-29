# Room mode: play from your own phone

Goal: one person creates a room, friends join from their phones with a link/QR, and everyone (host included) draws and sees their own secret target on their own phone.

## Found while testing (2026-10-28, live site, 375px phone)
- Host can't play: host is added as a player but the browser only keeps the host key, so the host's card says "Player draws on their phone" and they can never draw or see their own target.
- Joining is clunky: no link or QR; friends must open the site, find the "Room" tab, type their name and the 4-letter code.
- After joining, a friend's own "Draw target" button sits ~2.3 screens down (y=1875 on an 812px screen), under the setup panel and table.
- Friends still see Create/Join buttons, Reset, reds settings and sample-players (host-only, error if tapped).
- Server lets anyone draw or claim for another player by id (no token check).

## Plan
- [x] 1. Host is a real player: `create` also returns the host's playerToken/playerId; client stores both; server reveals the host's own secret only (still never anyone else's).
- [x] 2. Lock secrets to owners: `drawTarget` / `claimWin` require that player's own token.
- [x] 3. Join by link + QR: room box shows a QR code and Share/Copy link (`?room=CODE`). Opening the link goes straight to "Your name → Join".
- [x] 4. Phone-first room screen: "You" card at the top with your status and one big action; create/join form and host-only controls hidden from friends; "Leave room" added.
- [x] 5. Room as the front door: landing shows "Start a room" / "Join a room", with "Play on one shared device" as the secondary option.

## Verify
- [x] `npm run check`
- [x] Two separate browser sessions (host + friend) on 375px: create → open link → join → draw order → each draws own target → host marks a colour potted → knock-out shows → claim win.
- [x] Refresh a phone mid-game: stays in the room with its own target.
- [x] Single-device mode still works end to end.
- [x] Draft deploy, re-test on the draft URL, then promote to production.

## Review (2026-10-28)
Shipped to https://snooker-shuffle.netlify.app (deploy 6ae2a9e3e4c35e02fae4adea).

Extra fixes found during testing:
- Polling rebuilt host buttons every 3s, so a tap could be lost mid-redraw. Sections now only redraw when their content changes.
- Pocket text read "bottom middle middle pocket"; now "bottom middle pocket" / "bottom right corner pocket".
- An out player could still claim a win; server now refuses.
- Claim win and room reset now ask for confirmation (both affect everyone).
- Late joiners get "This game has already started" instead of a generic error.

Security checks on the draft: a friend can't see the host's target, can't claim for another player, can't mark colours potted, can't draw twice; the public GET shows no targets.

Follow-up (2026-10-28, deploy 6ae2acd77cf899e9c33ec9c2): winning pockets are now unique among players still in the game. Only 4 corners exist for 5 non-blue colours, so a fifth active non-blue target shares the least-used corner (rule written into RULES.md). Simulated 20,000 games against the server code: 0 violations (the previous code failed the same test even in 2-player games).
