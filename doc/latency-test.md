# Latency test

> Status: Draft. Beat count, tempo and the suggestion rule are a first pass, to tune after play-testing.

Measures how late (or early) the player's presses land against what they hear, with their own headphones, screen and input device, and suggests an input calibration ([settings.md](settings.md)). Each in-game computer has its own test window in its system's look, opened from the settings window. It replaced the stand-alone latency prototype page ([ADR 0010](decisions/0010-latency-test-in-game.md)).

## Opening it

| Scene | From | Window |
| --- | --- | --- |
| Windows XP | Settings window → "Test Latency..." | "Latency Test", a Luna dialog |
| Mac | Preferences window → "Test Latency…" | "Latency Test", an Aqua window |

The test window replaces the settings window over the level list; "Back", the close button or Esc returns to the settings window.

## Flow

1. The window opens idle: a short instruction ("Put on the headphones you play with…"), eight empty beat dots and "Start".
2. "Start" (or Enter) resumes audio and books every click on the audio clock at once, 120 BPM: **4 count-in clicks** (low pitch), then **8 measured clicks** (high pitch). The status line counts the count-in ("Count-in: 2 of 4"), then the beats ("Beat 5 of 8").
3. The player presses Space or clicks on each measured click. A press is matched to the nearest measured beat within half a beat; only the first press per beat counts, count-in presses are ignored.
4. Half a beat after the last measured click the run ends and the result shows.
5. "Use Suggested Value" sets the calibration and returns to the settings window; "Measure Again" (or R) runs it again.

Leaving the browser tab during a run stops it (back to idle), as a round does.

### Beat dots

| Dot | Look |
| --- | --- |
| Not reached | Empty, grey ring |
| Current beat | Yellow fill, orange ring |
| Pressed | Pale blue fill with an orange line where the press landed: left of centre early, right late, the cell's half-width standing for 150 ms |
| Missed (no press) | Empty, grey ring |

## Result

- Average offset (late / early) and spread (standard deviation) of the presses.
- **Suggested calibration**: the median offset of the presses, rounded to whole ms, after dropping the earliest and latest 10% (none with 8 presses). It needs **at least 5 of the 8 beats** pressed; with fewer the window says so and offers only "Measure Again".
- The current calibration is shown beside it; using the suggestion replaces it (clamped to ±300 ms like the slider).

The window's colours come from each scene's theme (`xp-luna.ts`, `aqua.ts`); the counting and statistics are shared (`src/latency/`).

## Time conversion

Beat time = first click + click index × (60 / BPM) on the `AudioContext` timeline (s); every click is booked with `AudioBufferSourceNode.start(beat time)`.

Input times start from `event.timeStamp` (on `performance.now()`'s timeline) and are converted to "the audio the speakers were playing at that moment":

- **Method A (getOutputTimestamp)**: a `{contextTime, performanceTime}` pair says audio at `contextTime` is leaving the speakers at `performanceTime`.
  `heard time = contextTime + (event.timeStamp − performanceTime) / 1000`
- **Method B (currentTime − latency)**: read `currentTime` and `performance.now()` in the callback.
  `heard time = currentTime − (performance.now() − event.timeStamp) / 1000 − baseLatency − outputLatency`

`offset = heard time − nearest beat time`.

Method A should be more accurate (unaffected by `currentTime` updating in blocks); B is the fallback where A is unavailable (older Safari) or not yet flowing. Both already remove the output latency the browser knows about; what remains (unknown latency such as some Bluetooth headphones, display and input devices, the player's habit) is what calibration removes.

Input times are converted the same way in levels (`src/game/input.ts`), so the test measures exactly what the judge sees before calibration.

## Test log

(Log measurements from the in-game test here: device, browser, headphones, suggested value and spread, conclusion.)

| Date | Device / OS | Browser | Output | Input | Suggested / spread | Notes |
| --- | --- | --- | --- | --- | --- | --- |
