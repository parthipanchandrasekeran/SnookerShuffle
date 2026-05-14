# SnookerShuffle

SnookerShuffle is a web app for running Shuffle Pool / snooker shuffle games without paper slips.

## Current Build

- Single-device local play works from `index.html`.
- Netlify room mode is wired for deployed sites.
- Players can create or join a room code after Netlify deployment.
- Start order is drawn from snooker colors without replacement.
- Qualified players privately draw a target color and exact corner pocket.
- Host controls can mark colors potted and trigger dead-ball states.
- Dead-ball players can redraw after potting the required extra red.
- Players can claim a win against their private color and pocket.

## Local Launch

Open:

```text
file:///D:/SnookerShuffle/index.html
```

Room mode needs Netlify Functions, so it only works after deploying to Netlify or running Netlify Dev.

## Netlify Deploy

The project includes:

- `netlify.toml`
- `package.json`
- `netlify/functions/game.js`

Netlify installs dependencies during deploy and publishes the project root.

## House Rules

- Before the game starts, every player draws a color to decide the play order.
- The player who draws the highest-point color starts first.
- Color values are: yellow 2, green 3, brown 4, blue 5, pink 6, black 7.
