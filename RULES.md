# Snooker Shuffle Rules

This is the working rule set for the SnookerShuffle website. Shuffle rules vary by club, so these should be configurable later.

## Ball Values

- Yellow: 2 points
- Green: 3 points
- Brown: 4 points
- Blue: 5 points
- Pink: 6 points
- Black: 7 points

## Deciding Who Plays First

Before the game starts, each player draws one color.

The player who draws the highest-value color plays first.

Example:

1. Ali draws blue, worth 5.
2. Sam draws black, worth 7.
3. Raj draws green, worth 3.
4. Sam starts because black has the highest value.

Suggested full play order: highest color to lowest color.

Example order:

1. Black
2. Pink
3. Blue
4. Brown
5. Green
6. Yellow

Each color can only be drawn once, so two players can never draw the same color or the same value.

## Red Balls Needed To Qualify

Players must pot red balls before they are allowed to draw their secret target color.

The number of reds needed should be based on the number of players.

Suggested default:

- 2 players: 3 reds to qualify
- 3 players: 2 reds to qualify
- 4 players: 2 reds to qualify
- 5 players: 1 red to qualify
- 6 players: 1 red to qualify

The app should allow this to be changed before the game starts.

## Qualifying

Before a player qualifies:

- They must play for reds.
- Reds can be potted in any pocket.
- If they hit a color first before qualifying, it is a foul.
- A foul can add one extra red to that player's qualification requirement.

The app does not need to track every red pot. Once a player has potted the required number of reds, they select an option to draw a random target color.

## Drawing A Target Color

After potting the required reds, the player selects a draw option and receives one random secret target color from the available colors:

- Yellow
- Green
- Brown
- Blue
- Pink
- Black

The player should be able to see their own color and where to pot it, but other players should not see it.

After the player has seen their target color and pocket guide, the display should disappear or hide behind a privacy screen so the next player cannot see it.

## Where To Pot The Target Color

After a player has drawn a target color, the app should guide them clearly:

- Show the target color.
- Show the exact pocket where the target color must be potted.
- Show a table map with that pocket highlighted.
- By default, non-blue colors must be potted in the assigned corner pocket.
- Blue must be potted in one of the two assigned middle pockets.

Possible winning pockets:

- Top-left corner
- Top-right corner
- Bottom-left corner
- Bottom-right corner
- Top-middle pocket for blue
- Bottom-middle pocket for blue

Middle pockets only count as a winning pot for blue unless house rules allow otherwise.

## Winning

A qualified player wins when they pot their own secret target color into their assigned winning pocket.

Default winning pockets: one assigned corner pocket, except blue uses one assigned middle pocket.

When a player claims the win, the app should reveal their target color and assigned pocket, then confirm whether the potted color and pocket were valid.

## Dead Ball

A dead ball happens when a player's secret target color has already been potted by someone else.

Suggested default rule:

- The player marks their color as dead.
- They must pot one more red.
- Then they draw another available color.

If no target colors are available, the app should decide the winner using the end-game rule.

## Qualified Players Potting Other Colors

After qualifying, a player may pot colors that are not their own to stop other players from winning.

This can make another player's secret color become dead.

## End Of Game

The game ends when:

- A qualified player pots their own target color in a valid winning pocket, or
- Only one player remains eligible and no reds or target colors are available.

## App Logic Summary

1. Add players.
2. Draw colors for start order.
3. Sort players by drawn color value, highest first.
4. Set red qualification target based on player count.
5. Start game.
6. When a player has potted the required reds, they select the draw option.
7. The app gives that player one random secret target color.
8. The app privately shows that player the exact pocket where their target color must be potted, with a table map.
9. The color and pocket guide then disappear so other players cannot see it.
10. Track used target colors, dead balls, fouls, and re-draws only where needed.
11. Confirm win only if the player's target color is potted in the assigned pocket.
