# Official level design guidelines

> Status: Draft. The three rules are set by the user; details marked provisional and the open questions are not. Decision record: [ADR 0007](decisions/0007-official-level-design-guidelines.md).

Official levels are the charts shipped in `public/charts/` and listed in `index.json`. Every new or changed official level follows the three rules below.

## Shape of a round

```
Level select ──► intro ──► ┌─ demos of the actions new in the next phrases (generated, unscored, skippable)
                           └─ chart from those phrases up to the next new action ─┐ (repeat to the end) ──► results
```

The intro ([hub.md](hub.md)) is dismissed by the player's first press, and the scene starts after it, so the first demo follows the intro. A chart that uses all its actions in the first phrase plays as before: every demo, then the whole chart.

## Rule 1: the system demonstrates every action before it is used

**The demo is not written in the chart**; the game generates it ([ADR 0007](decisions/0007-official-level-design-guidelines.md), timing from [ADR 0008](decisions/0008-demos-before-each-new-action.md)). Before the first phrase that uses an action, the chart stops and that action is demonstrated; it must be played back successfully before the next.

| Item | Rule |
| --- | --- |
| Which actions | Every action ID in the chart (`call` and `response`), once each |
| When | Right before the first phrase that uses it: the chart stops after the previous phrase, runs the demos of that phrase's new actions, then resumes from that phrase |
| How | One call and response round: the computer does it, then the player does it on the same beats |
| Next action | After the round ends with a successful response |
| On failure | Repeat that action until it passes |
| The chart resumes | When every new action of that phrase has passed |
| Scoring | Practice only: **not** counted in the score, results or best score. The chart's pieces count together, as if played in one go |
| Skipping | Skips every demo. "Skip tutorial" in the settings ([settings.md](settings.md)) plays the chart in one go; **Backspace** during a demo ends it and plays the rest of the chart in one go, with no later demo |

For chart authors: the first phrase is real content, so don't write a teaching phrase at the start; every phrase that brings in a new action type pauses the chart for its demo, so bring new actions in where a pause sits well.

### Provisional details

- **Order**: within a stop, actions in order of first appearance.
- **Tempo**: the chart's BPM and metre.
- **Each round**: a one-phrase chart (a call bar, a response bar, no outro) with the action on beat 1; two-press actions keep their half-beat spacing. Only the level's first round opens with one count-in bar.
- **Pass**: no Miss on any press of the round (Perfect or Good).
- **Resuming**: the first piece keeps the chart's count-in when no demo comes before it; a piece that follows a demo has no count-in. Only the last piece has the outro.
- **One beat throughout**: demos, retries and the chart's pieces follow on without a break and without a count-in: each round's first call bar starts exactly on the beat the round before ends, so the level keeps one beat grid and the call comes straight after the response. The next round is booked on the audio clock shortly before the round on ends; the round on drops its closing hit, which would fall on the next round's first beat. The screen passes to the next round half a beat early (with the "Follow me" banner, and windows can start popping up), which is safe because judging of every phrase but the last is over by then ([turn cue spacing](prototypes/mvp.md)); the round on's last sounds still play. The beat guide keeps counting beats past the round's end, and shows the next round's presses once it is booked. If a demo's last press is judged too late to book ahead, the next round starts on a later bar line of the same grid, with a count-in bar. Backspace during a demo starts the rest of the chart on the demo's next bar line, with a count-in bar.
- **Caption**: right of the "Follow me / Your turn" banner, "Practice 2 of 4" (or "Try again") over the action name and how to handle it, counted over the whole level, with "Backspace: skip" at its top right; texts in `src/rhythm/tutorial.ts`.
- **When**: entering a level from the list or "Next Level"; "Retry" on the results skips the demos.
- **Skip toggle**: "Skip tutorial" in the settings window ([settings.md](settings.md)), saved in the browser.

## Rule 2: easy to hard

Difficulty **rises phrase by phrase**: the start is easiest and the climax comes late. A lighter phrase between hard ones is fine, but the overall trend goes up.

The BPM is fixed for the whole chart, so difficulty comes from these; move from the left column towards the right as the chart goes on:

| Factor | Easy | Hard |
| --- | --- | --- |
| Beat positions | Whole beats only | Off-beats (`x.5`), syncopation, dotted rhythms |
| Presses per bar | 1–2 | 4 or more, runs of eighths |
| Actions per phrase | One kind | Several mixed |
| Two-press actions | None | Right next to other actions |
| Call vs response | The same (no `response`) | A different response rhythm |
| Rests | Regular, predictable | Unexpected gaps |

Suggested sections (provisional): an opening quarter on whole beats with one action per phrase in demo order; a middle adding off-beats, rests and two mixed actions; a dense, mixed climax; an ending that eases off or finishes on the climax.

## Rule 3: at least 1 minute of chart

The chart lasts at least **60 seconds**, counted to its end beat (as the level details show), including count-in and outro but **not** the demo:

```
total beats = (countInBars + outroBars) × beatsPerBar + Σ over phrases (2 × beatsPerBar + gap beats)
seconds     = total beats × 60 ÷ bpm
```

In 4/4 with no gap a phrase is 8 beats: at 120 BPM a minute takes 14 phrases plus one bar each of count-in and outro.

## Rule 4: a full level set (official levels)

Set by the user on 2026-10-25 ([ADR 0016](decisions/0016-five-official-levels-per-scene.md)). Each scene ships **five** official levels, in `index.json` order from first to last.

| Item | Rule |
| --- | --- |
| Presses | At least **100** judged presses in the responses (a two-press action counts 2; automatic releases and landings don't count) |
| Widgets per level | Many widgets per level, **more from level to level**: the first level uses a few, the last uses every action of the scene |
| Easy and hard widgets | Every level mixes easy one-press widgets with harder ones (two-press, holds, waits); a level is never only easy or only hard widgets |
| Tempo | The BPM **rises from level to level**, in small steps (about 6–8 BPM), never extreme |
| Rhythm | Presses sit on the drum grid (whole beats and off-beats `x.5`) and build on repeated patterns with variations, so phrases feel like music, not random taps |
| New widgets | A level brings its new widgets in at section starts, several in one phrase where they fit, so the chart stops for demos only a few times |

The current set and its tempos are listed in [scenes/windows-xp-levels.md](scenes/windows-xp-levels.md#levels-charts) and [scenes/mac-2000.md](scenes/mac-2000.md#charts).

## Candidates / open questions

- Checking "at least 60 seconds" at load time so `vp test` fails short official charts. Rule 2 can't be checked automatically.
- A limit on demo failures (e.g. a stronger hint after 3), and skipping a demo midway.
- How the demo is presented: where the caption sits, and which system widget shows it (XP balloon tip / Mac help tag…).
- Whether player-made charts, if ever supported, follow these rules.
