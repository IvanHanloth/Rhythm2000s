# Combo

> Status: Draft. Decision record: [ADR 0013](decisions/0013-combo-feedback-in-the-scene.md). Thresholds and effects are a first pass, to tune after play-testing.

Hitting response targets in a row builds a combo. The combo is feedback only: it doesn't change the score ([results.md](results.md)). It shows as a period web "hit counter" in the corner, and as the computer itself getting livelier, rather than a big number in the middle of the screen. Like the rest of the scene it follows the audio clock and the beat ([ADR 0002](decisions/0002-game-canvas-and-scenes.md)).

## Counting

- Each judged response press of the chart counts: Perfect or Good adds 1; a Miss (late, unpressed, or an early press, see [prototypes/mvp.md](prototypes/mvp.md#judging-rules)) resets it to 0. Two-press actions count each press.
- Only the chart counts. Action demos ([level-design.md](level-design.md)) don't: the combo pauses while a demo runs and carries on when the chart resumes.
- A level starts at 0, and so does Retry.
- The level remembers its **best combo** for the results window.

## Hit counter

A GeoCities-style hit counter: black digit cells with white digits and the caption "HITS", in the top right corner of the screen, clear of the turn banner, the menu bar and the targets.

- It shows while the chart plays; it is hidden on the level list, the results and during demos.
- Each hit adds 1 and the last digit rolls up like an odometer (1/8 beat). A reset rolls every digit back to 0 and the cells flash red for half a beat.
- From the second tier a small "HOT!" flame flickers beside it, flaring on each beat.

## Tiers

| Tier | From | Windows XP | Mac |
| --- | --- | --- | --- |
| 1 | 8 | Desktop icons hop on each beat | Glassy Aqua bubbles rise up the wallpaper from the Dock; on each beat a new row starts and the oldest row pops |
| 2 | 16 | The wallpaper turns into a Windows Media Player visualization: Bliss dims behind it, glowing swirls turn slowly with a ring pulsing out on each beat, and spectrum bars along the bottom jump on each beat; "HOT!" beside the counter | The menu bar and the Dock shelf glow on each beat; "HOT!" beside the counter |
| 3 | 30 | The Solitaire win cascade: cards fly off the four foundation piles at the top right one by one, every other beat, and bounce across the desktop, landing on each beat and leaving a trail of copies | The Flurry screen saver (Mac OS X 10.2's default): the wallpaper dims and glowing ribbons stream and curl out of the middle of the screen, flaring on each beat |

- Effects add up: tier 3 keeps the tier 1 and 2 effects.
- The thresholds suit the current charts, which have 35–40 presses, so a clean run reaches tier 3; raise them when the charts grow to a minute or more.
- Nothing on the Mac moves the Dock icons: a Dock icon moving is the `dock-bounce` action, so an effect there would look like a target (the first version swelled them in a wave at tier 1).
- Everything sits behind the windows and dialogs, so no effect covers a target. No effect uses a widget that is also an action (tray balloons, download window, Dock bounce), so nothing looks like a new target.
- On a reset the effects stop at once.

### Windows XP details

- **Media Player visualization** (after Windows Media Player 9's "Ambience" and "Bars and Waves"; drawn, not taken from the player): a dark layer fades in over Bliss in one beat so the colours stand out, Bliss still faint behind. Three soft swirls turn around the centre of the screen; each beat a ring grows from the centre and fades by the next. 32 bars stand along the bottom of the work area: on each beat they jump to a height that changes bar by bar and beat by beat (the bass end higher) and fall back by the next beat, a smaller jump on the half beat, with a peak cap that drops more slowly. Heights come from the beat number, not the sound, so the same beat always looks the same.
- **Solitaire win cascade** (after XP Solitaire's win): cards at their original 71 × 96 px leave the foundation piles in Solitaire's order, the four Kings, then the Queens, and so on down to the Aces, then again from the Kings. Each falls to the bottom of the work area, landing on the next beat, and bounces once per beat, each bounce lower than the last, while drifting sideways at its own steady speed until it leaves the screen. Each card leaves a trail of copies for 3 beats that fades over the last beat; the original keeps its trail for good, which would bury the desktop. Cards stay under the desktop icons, so the Recycle Bin is never covered.

### Mac details

- **Aqua bubbles** (drawn like the Aqua gel buttons: a see-through blue body, a lighter rim and a white shine at the top): on each beat a row of 6 bubbles of different sizes starts just above the Dock, at spread-out places that change from beat to beat. Each rises to just under the menu bar over 4 beats, swaying a little from side to side, and pops on the beat it reaches the top: a ring grows and fades over a quarter beat. So every beat one row starts and one pops. The bubbles fade in over a beat when the tier is reached, and stay under the Dock and every window.
- **Flurry** (after the screen saver's look; drawn, not taken from it): a dark layer fades in over the wallpaper in one beat, like the screen saver's black. Four ribbons, each in its own colour, stream out of a source that wanders slowly round the middle of the screen; each ribbon curls as it goes, widening and fading towards its end, and the direction it leaves in turns slowly. On each beat the ribbons flare brighter and wider and fall back by the next. The ribbons glow on top of the dark layer; the Aqua bubbles keep rising in front of them.

## Combo break

When a combo of 10 or more resets:

- **Windows XP**: the "Hardware Remove" sound plays (the unplug chime, a short "disconnected").
- **Mac**: the spinning wait cursor (the "beach ball") appears beside the hit counter for one beat.

Shorter combos only reset the counter.

## Results

The results window adds a "Best combo" line. A chart with no Miss at all earns a "Full Combo" stamp next to the rating stamp ([results.md](results.md)).

## Candidates / open questions

> Ideas only, not decided.

- Sounds at each tier.
- Keeping each level's best combo, like the best score.
