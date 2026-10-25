# MVP: pop up → close

> Status: Draft
>
> Goal: one complete call → response → judgement loop in the Windows XP scene, to try the feel. Numbers and the chart are **MVP provisional**, to adjust after play-testing.

## Confirmed

| Item | MVP |
| --- | --- |
| Scene and action | Windows XP. Call: the computer pops up a series of windows on the beat; response: the player closes them one by one in the same rhythm |
| Input | Space, or a click anywhere on the canvas, closes a window; no need to hit the close button |
| Judgement windows | Perfect within ±60 ms; Good within ±130 ms; otherwise or unpressed, Miss. Pressing 130–250 ms before a target is also a Miss (against mashing). Widened on 2026-10-24 from ±45 / ±100 / 200 ms, which play-testing found too hard |
| Music | A simple drum beat synthesised with Web Audio, no sample files |

## Flow

1. After the intro, one count-in bar (hi-hat and metronome clicks).
2. Each phrase is a **call bar**, where boxes pop up on the beat with their XP alert sounds, then a **response bar**, where the player closes them at the same relative positions. The window to close next has an active title bar, the rest inactive. Charts may add a gap between the two (hi-hat only, "Your turn" already showing); the current charts use none.
3. One bar after the last phrase, the results window opens with tada.

A virtual mouse demonstrates in the call and, in the response, waits on the next box's button and clicks when the player presses, see [scenes/windows-xp.md](../scenes/windows-xp.md#virtual-mouse).

## Turn cue

A banner at the top says whose turn it is: **Follow me** in the call bar (watch and listen), **Your turn** in the response bar (in the accent colour, more prominent).

- Follow me appears half a beat before the call bar; Your turn half a beat **before the call bar ends**, giving the player a beat to get ready.
- Your turn lasts to the end of the phrase, switching back to Follow me half a beat before the next call bar; the banner disappears after the last phrase and first appears in the last half beat of the count-in.
- Each switch squashes and springs back once (`beat-squash`, 0.125 beat), timed by the audio clock.
- Because of the early switch, the last action of a call or response bar must have its Good window closed half a beat before the bar ends. At 120 BPM Good is 0.26 beat, so the last action must come before beat 3.24 (beat 3 fits, 3.25 doesn't); validation checks this.
- It shows on every phrase.

## Judging rules

- Each call event has one response target.
- Each input takes **the earliest unjudged target within its Good window**, graded Perfect or Good by offset, and that window closes at once.
- **Early presses are Misses**: an input before the earliest unjudged target, outside Good but within 250 ms (offset −250 to −130 ms), marks that target a Miss, like a missed one. Mashing always lands some presses there, so it misses a lot.
- Inputs further away (over 250 ms early, or after a target is judged) neither score nor cost.
- A target with no input by the end of its Good window is a Miss: XP's Default Beep plays and the box's title bar flashes like clicking outside a modal box; it stays put and fades at the end of the phrase.
- The judged input time is the heard audio time (conversion in the [latency test](../latency-test.md#time-conversion)) minus the player's calibration, set in the settings window in ms ([settings.md](../settings.md)) (positive means the player presses late; the [latency test](../latency-test.md) suggests a value).

## Sounds

Drums and metronome are synthesised; interface sounds are the original XP ones ([scenes/windows-xp.md](../scenes/windows-xp.md#sounds)):

- Drums: call and response bars each start on beat 1 with kick on 1 and 3, snare on 2 and 4, hi-hat every half beat; a gap has hi-hat only.
- Pop-up: booked on the call beat, by box kind (information, warning, error, question).
- Close: a click played immediately when the input is Perfect or Good (following the player, not the beat).
- Miss: XP's Default Beep, immediately.
- End of round: tada as the results open.

## Animation

Durations come from the design system's `beat-*` tokens and are computed from the audio clock each frame:

- Windows pop up over 0.25 beat, reaching full size exactly on the call beat.
- Windows close over 0.125 beat from the input.
- Judgement labels squash and spring back over 0.125 beat, hold for 1 beat, then fade over 0.25 beat.

## Chart (MVP provisional)

120 BPM, 4 beats per bar, 8 phrases; beat positions within the call bar (from 0):

| Phrase | Rhythm |
| --- | --- |
| 1 | 0, 1, 2 |
| 2 | 0, 1, 2 |
| 3 | 0, 1, 2, 3 |
| 4 | 0, 0.5, 1, 2 |
| 5 | 0, 1, 1.5, 2 |
| 6 | 0, 1, 2, 2.5, 3 |
| 7 | 0, 0.5, 1, 1.5, 2 |
| 8 | 0, 0.5, 1, 2, 3 |

No gap; one count-in bar, 8 phrases of 2 bars and one outro bar make 72 beats, about 36 seconds. Every action is `dialog-info` ([ADR 0006](../decisions/0006-actions-named-after-ui-classes.md)), with the response the same as the call. The chart was `public/charts/xp-popup-mvp.json` ([chart-format.md](../chart-format.md)); since the official levels replaced it ([ADR 0016](../decisions/0016-five-official-levels-per-scene.md)) it is kept only as a unit-test fixture, `src/scenes/windows-xp/test-mvp-chart.json`.

## Things to watch in play-testing

- Whether the judgement windows feel right; how many Goods.
- Whether close sounds that follow the input feel sluggish on high-latency devices.
- Whether click and Space feel noticeably different.
- Whether a gap helps players prepare or breaks the flow, and whether the cue needs a sound.
