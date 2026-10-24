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
| 1 | 10 | Desktop icons hop on each beat | Dock icons swell in a wave on each beat, like Dock magnification |
| 2 | 25 | The Bliss sky brightens and soft clouds drift across it; "HOT!" beside the counter | The menu bar and the Dock shelf glow on each beat; "HOT!" beside the counter |
| 3 | 50 | "3D Pipes" from the XP screen saver grow along the screen edges, one segment per beat | iTunes-visualizer light bands flow across the wallpaper |

- Effects add up: tier 3 keeps the tier 1 and 2 effects.
- Everything sits behind the windows and dialogs, so no effect covers a target. No effect uses a widget that is also an action (tray balloons, download window, Dock bounce), so nothing looks like a new target.
- On a reset the effects stop at once.

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
