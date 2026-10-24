# Official level design guidelines

> Status: Draft. The three rules are set by the user; details marked provisional and the open questions are not. Decision record: [ADR 0007](decisions/0007-official-level-design-guidelines.md).

Official levels are the charts shipped in `public/charts/` and listed in `index.json`. Every new or changed official level follows the three rules below.

## Shape of a round

```
Level select ──► intro ──► action demo (generated, unscored, skippable) ──► chart (count-in → phrases → outro) ──► results
```

The intro ([hub.md](hub.md)) is dismissed by the player's first press, and the scene starts after it, so the demo follows the intro.

## Rule 1: the system demonstrates every action first

**The demo is not written in the chart**; the game generates it. Before the chart, every action the chart uses is demonstrated and must be played back successfully before the next.

| Item | Rule |
| --- | --- |
| Which actions | Every action ID in the chart (`call` and `response`), once each |
| How | One call and response round: the computer does it, then the player does it on the same beats |
| Next action | After the round ends with a successful response |
| On failure | Repeat that action until it passes |
| The chart starts | When every action has passed |
| Scoring | Practice only: **not** counted in the score, results or best score |
| Skipping | "Skip tutorial" in the settings starts straight from the chart, see [settings.md](settings.md) |

For chart authors: the first phrase is real content, so don't write a teaching phrase at the start; and every extra action type adds a demo round before the chart.

### Provisional details

- **Order**: actions in order of first appearance.
- **Tempo**: the chart's BPM and metre.
- **Each round**: a one-phrase chart (one count-in bar, a call bar, a response bar, no outro) with the action on beat 1; two-press actions keep their half-beat spacing.
- **Pass**: no Miss on any press of the round (Perfect or Good).
- **Caption**: right of the "Follow me / Your turn" banner, "Practice 2 of 4" (or "Try again") over the action name and how to handle it; texts in `src/rhythm/tutorial.ts`.
- **When**: entering a level from the list or "Next Level"; "Retry" on the results skips it.
- **Skip toggle**: in the dev panel until the settings page exists, saved in the browser.

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

During development new charts may be shorter; all charts are rewritten to this rule in the polish phase.

## Candidates / open questions

- Checking "at least 60 seconds" at load time so `vp test` fails short official charts. Rule 2 can't be checked automatically.
- A limit on demo failures (e.g. a stronger hint after 3), and skipping a demo midway.
- How the demo is presented: where the caption sits, and which system widget shows it (XP balloon tip / Mac help tag…).
- Ordering levels easy to hard within a scene, remix last (roughly how `index.json` is ordered now).
- Whether player-made charts, if ever supported, follow these rules.
