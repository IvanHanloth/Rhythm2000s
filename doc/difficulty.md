# Difficulty

> Status: Draft. The five speeds come from the user; how the difficulty shows on screen is a first pass, to tune after play-testing.

Each save has a difficulty that sets how fast every chart plays. It is picked when a new game is created and can be changed later in the settings window. Decision record: [ADR 0019](decisions/0019-difficulty-sets-chart-speed.md).

## The five difficulties

| Difficulty | Chart speed |
| --- | --- |
| Heaven | ×0.5 |
| Easy | ×0.8 |
| Normal | ×1.0 (the default) |
| Hard | ×1.2 |
| Hell | ×1.5 |

## What the speed changes

- A level plays its chart at the chart's own tempo times the speed: a 120 BPM chart plays at 180 BPM on Hell and 60 BPM on Heaven. Everything follows the tempo, since the chart, the demos, the drums, the turn cues and the beat guide are all in beats.
- The judgement windows stay the same in milliseconds ([prototypes/mvp.md](prototypes/mvp.md)), so faster speeds leave less time between presses.
- The level intro shows the tempo the level will play at and the difficulty, e.g. "Tempo 168 BPM", "Difficulty Hard (×1.2)" ([level-select.md](level-select.md)). The level list keeps showing each chart's own tempo.
- HackerEditor's Play and Test and the showcase computers always play at the chart's own tempo ([chart-editor.md](chart-editor.md), [showcase.md](showcase.md)).
- Every chart must work at every speed: the turn-cue timing check runs at the fastest speed, ×1.5 ([chart-format.md](chart-format.md#timing-limits)).

## Scores

- The **recorded score** is the round's score (0–10000, [results.md](results.md)) times the speed, rounded: 8500 on Hell is recorded as 12750, on Heaven as 4250.
- The recorded score is what the results window shows in large digits, what "New record" compares and what is kept as the chart's best. The Score box's title gives the working, e.g. "Score — Hell (8500 × 1.5)".
- The rating ("Superb", "OK", "Try again") and the comments still come from the unscaled score, so they mean the same at every difficulty.
- Every best score is kept with the difficulty it was set on, and the level intro shows it, e.g. "Best score 12750 (Hell)" or "Best score 04250 (Heaven, Beat Guide)". One best is kept per chart whatever the difficulty, so a higher recorded score on any difficulty replaces it.

## Choosing it

- **New Game**: under the name field, five radio buttons, Normal picked at first ([save-slots.md](save-slots.md#title-screen)).
- **Settings**: the settings window has a Difficulty group with the same five choices ([settings.md](settings.md)). It shows and changes the current save's difficulty; other saves keep theirs. A change applies from the next level started.
- Saves made before difficulties existed are Normal, and their best scores are marked Normal.

## Code

- `src/rhythm/difficulty.ts`: the difficulties, their speeds, the chart at a speed and the recorded score.
- The current save's difficulty and each best score's difficulty are in `src/game/save-progress.ts`.

## Candidates / open questions

> Ideas only, not decided.

- Keeping a best score per difficulty instead of one per chart.
- Scaling the judgement windows with the speed.
