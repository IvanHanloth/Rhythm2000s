# Dance machine

> Status: Draft (prototype). Decision record: [ADR 0021](decisions/0021-dance-machine-scrolling-arrows.md).

The dance machine at FUNLAND AMUSEMENTS ([hub.md](hub.md)) is playable: a 2D arcade dance game where arrows fly out from the centre of the screen to a ring of fixed targets and the player steps each one as it arrives. Unlike the desktop scenes it is **not call and response**; it plays like the classic dance machines of the late 1990s and early 2000s.

## Decided (user, 2026-10-25)

- **Gameplay**: arrows travel to fixed targets and are hit as they arrive, not call and response.
- **Entry**: the dance machine in the arcade. It no longer reads "OUT OF USE"; walking up to it shows "Play · Dance machine" and E opens the game.
- **Eight directions**: the single arrows ↑ ↓ ← → and the diagonals ↖ ↗ ↙ ↘. A diagonal is made by pressing its two keys together: ← and ↑ make ↖, ↑ and → make ↗, ← and ↓ make ↙, ↓ and → make ↘. Opposite pairs (←→, ↑↓) are not steps.
- **A diagonal is one target**: both keys must be pressed inside the Good window; the step's grade is the worse of the two presses, and it counts once in the combo and score.
- **Pad ring**: the eight targets sit around the centre of the screen where they are on the pad (↑ at the top, ↘ bottom right…); each arrow flies out from the centre to its target.
- **Keys**: the arrow keys and WASD (W ↑, A ←, S ↓, D →), both at once.
- **The cabinet in the street shows something on its screen**, and its model is more detailed than the first box placeholder (below).
- *Revised the same day*: the first build had four lanes of arrows rising up the screen, with "jumps" of any two arrows (←→, ↑↓…). The user replaced the jumps with the four diagonals and picked the ring layout.

## Flow

```
Street ──E at the dance machine──► Song list ──Enter──► Song ──► Results ──Enter──► Song list
                                       │                  │
                                       └────Esc───► Street └──Esc──► Song list
```

- **From 3D to 2D** (user request, 2026-10-25): pressing E at the machine makes the character step onto the pad and turn to the screen while the camera comes round behind them; then the camera pushes into the cabinet's screen as the view fades, and the 2D song list takes over, like sitting down at a café computer. Leaving the machine (Esc on the song list) brings the street back with the character standing on the pad and the camera behind.
- **Song list**: every dance chart, with its title, tempo, foot rating and the current save's best score. ↑ / ↓ (or W / S) picks, Enter or Space starts. Esc goes back to the street.
- **Song**: a count-in, then the chart. Esc stops it and goes back to the song list without a result.
- **Results**: Perfect / Good / Miss counts, best combo, score and rating, "Full Combo" when nothing was missed. Enter, Space or Esc goes back to the song list.
- URL route: `#dance-machine`, so a refresh stays at the machine (like the café computers' routes).

## Screen (provisional)

- 1280×720 like the other scenes, drawn in PixiJS from the audio clock.
- A dark arcade screen with a neon grid that pulses on every beat; the title "DANCE MACHINE" with "FUNLAND AMUSEMENTS" under it on the song list.
- **Pad**: a small picture of the dance pad at the centre of the screen: four arrow panels around a middle plate, each lighting up while its key is held.
- **Targets**: eight grey arrow outlines on a ring around the pad, each pointing outward in its direction. A target lights up while exactly its keys are held, so holding ← and ↑ lights ↖.
- **Arrows** appear at the edge of the pad two beats before their beat, small, and fly outward, growing to full size as they reach their target on the beat. Colour follows the beat, as on the period machines: whole beats red, half beats blue, quarter beats yellow.
- A hit arrow vanishes with a burst at its target; a missed one keeps flying past, faded, and fades out.
- The judgement word (shared Perfect! / Good / Miss) and the combo count show on the left of the ring; the title and score are in the top corners.

## Judging

- Same windows as the rest of the game: Perfect ±60 ms, Good ±130 ms; judging uses the heard time of the key press minus the player's calibration ([settings.md](settings.md)).
- A key press matches the earliest unjudged step **that needs that key** whose Good window it falls in. A step is judged once all its keys are pressed (worse grade of the two for diagonals); if its Good window closes first, it is a Miss, even with one key of a diagonal down.
- A press 130–250 ms early on a key that the next step needs makes that step a Miss, as in the desktop scenes, so mashing can't guess. Any other press does nothing.
- The cheat code ([cheat-code.md](cheat-code.md)) works here too: every step is Perfect and no score is saved.
- Score and rating use the shared rules of [results.md](results.md) (Perfect 1, Good 0.5, out of 10000; Superb from 8000, OK from 6000). The best score is kept per dance chart in the current save; dance charts don't count toward the Rickroll unlock.
- Dance songs always play at their own tempo, whatever the save's difficulty ([difficulty.md](difficulty.md)), so their best scores are recorded unscaled, as Normal (×1.0).

## Sound

- Synthesised like the scenes' backing: one count-in bar of metronome, then kick and snare on alternate beats with a hi-hat every half beat, plus a square-wave bass line on a four-bar chord loop; a final hit after the last step.
- No sound on a step; the music is the cue.

## Chart format

Dance charts are their own JSON files in `assets/public/dance/`, apart from the desktop charts, since they have no phrases, calls or responses.

```
assets/public/dance/
├── index.json          # { "format": 1, "charts": ["dance-byte-step.json", …] }
└── dance-byte-step.json
```

```json
{
  "format": 1,
  "id": "dance-byte-step",
  "title": "Byte Step",
  "bpm": 100,
  "level": 2,
  "beatsPerBar": 4,
  "countInBars": 1,
  "outroBars": 1,
  "steps": [
    { "beat": 0, "direction": "left" },
    { "beat": 1, "direction": "up-left" }
  ]
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | integer | `1` |
| `id` | string | Lowercase letters, digits and hyphens; must match the file name |
| `title` | string | Song title |
| `bpm` | number | Above 0 |
| `level` | integer | Foot rating shown on the song list, 1–10 |
| `beatsPerBar` | integer | Above 0 |
| `countInBars` | integer | Metronome bars before beat 0, 0 or more |
| `outroBars` | integer | Bars after the bar of the last step, 0 or more |
| `steps` | array | At least one step |

A step is `{ "beat", "direction" }`:

- `beat` counts from the first beat after the count-in, in quarters of a beat (`0`, `0.25`, `0.5`, `0.75`…), ascending with no two steps on the same beat.
- `direction` is one of `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left`, `down-right`.
- Unknown fields are errors. Invalid charts are skipped with their errors in the browser console, like desktop charts.

## First songs (provisional)

Three songs from easy to hard, each at least one minute: Byte Step (100 BPM, level 2; quarter notes, the first diagonals late on), Y2K Bug (128 BPM, level 5; half beats and all four diagonals), Broadband (150 BPM, level 8; runs round the ring, quarter-beat pairs and diagonals on the off-beat). Titles and steps are placeholders.

## The cabinet in the street (provisional)

- **Screen**: an attract loop drawn on a canvas and shown on the cabinet's screen: the title "DANCE MACHINE", the ring of eight targets with arrows flying out to them in turn, and "PRESS E TO PLAY" blinking. It runs on the street's own clock, not the audio clock, since nothing is judged.
- **Placeholder model** (until a custom `dance-machine` model exists, [hub-assets.md](hub-assets.md)): a metal pad with four arrow panels and a centre plate, a safety bar behind the player, a cabinet with the screen, a marquee light box, two speaker stacks and coloured light strips. The screen is a separate plane, and a custom model's `SCREEN` mesh gets the same attract loop.

## Candidates / open questions

- Freeze (hold) arrows, a life gauge that can end the song early, speed modifiers.
- Real music instead of the synthesised loop; what the songs and the machine's name should be.
- A dancer or video background behind the arrows.
- Whether dance charts should get HackerEditor, import / export and the save's difficulty speed like the desktop charts.
- Whether a full combo or score here should count toward anything on the street.

## Code

- `src/dance/steps.ts`: keys, directions, dance chart types and validation (no PixiJS).
- `src/dance/step-judge.ts`: per-key judging with diagonals as one target (no PixiJS).
- `src/dance/backing.ts`: the drum and bass track.
- `src/dance/dance-machine.ts`: the screen (song list, play, results) in PixiJS.
- `src/dance/input.ts`: arrow and WASD keys with their heard times, and which are held.
- `src/theme/dance-machine.ts`: colours.
- `src/game/main.ts`: the `#dance-machine` route; `src/hub/world.ts`, `src/hub/hub.ts`: the playable dance machine and its placeholder model; `src/hub/dance-attract.ts`: the cabinet's attract screen.
