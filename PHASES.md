# SnookerShuffle Build Phases

## Phase 1: Single-Device Game Helper

Goal: replace the paper draw for one shared device passed around the table.

- Add and remove 2 to 6 players.
- Draw start order from the six snooker colors, without replacement.
- Sort play order by highest-value drawn color.
- Show the red qualification requirement based on player count.
- Let a qualified player privately draw a target color.
- Assign an exact winning corner pocket for that target color.
- Show a private color-and-pocket reveal with a table map.
- Hide the reveal before the device is passed to the next player.
- Keep target colors unique in one game.
- Add a reset flow.

## Phase 2: Table-Ready Gameplay Controls

Goal: make the single-device version useful during a real game.

- Add a clear current-player view.
- Add "player qualified" and "draw target" states.
- Add dead-ball handling.
- Add re-draw after a dead ball.
- Add simple foul handling for house rules.
- Add win confirmation by color and pocket.
- Add a game-complete screen.
- Add optional rule settings before the game starts.

## Phase 3: Multi-Device Room Mode

Goal: allow multiple players to open the same game on their own phones.

- Create a game room with a short code.
- Let players join by room code or QR code.
- Store game state on a server.
- Sync player list, start order, used colors, and game status.
- Keep each player's target color private.
- Prevent duplicate color and pocket assignments.
- Add reconnect support if a phone refreshes.

## Phase 4: Admin And Host Controls

Goal: give one host control over the game without revealing secrets.

- Host starts the game.
- Host manages player names and order draw.
- Host can mark colors potted.
- Host can confirm wins.
- Host can handle dead balls and re-draws.
- Host cannot see secret target colors until a player claims a win.

## Phase 5: Polish And Launch

Goal: make it feel reliable, fast, and easy at the table.

- Mobile-first interface pass.
- QR-code join screen.
- Save house rules.
- Add light/dark table modes if useful.
- Add installable PWA support.
- Add offline single-device mode.
- Add basic tests for draw logic.
- Deploy the multi-device version.
