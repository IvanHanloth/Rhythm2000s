# Prototype: latency test

> Status: Draft
>
> Goal: answer the risks in [tech-research.md](../tech-research.md), section 5, with measurements for judging and calibration design. **This prototype is not the game and doesn't set judgement windows.**

## Questions

| No. | Question | How the prototype answers it |
| --- | --- | --- |
| Q1 | Is the reported `outputLatency` accurate? | Convert input times two ways (below) and compare their difference with measured offsets |
| Q2 | Offset distribution of keyboard, mouse and touch | Mean, median and standard deviation per input type |
| Q4 | Does calibration rescue Bluetooth headphones? | Retest with them and compare the suggested calibration and spread |
| Q5 | Does `getOutputTimestamp()` work on Safari? | The page shows its raw values and availability; method B is used when it isn't available |

Q3 (the effect of having to aim the mouse) is an input design question, tested separately.

## Flow

1. The page shows device info (sample rate, `baseLatency`, `outputLatency`, browser).
2. "Start" creates / resumes the `AudioContext` and a metronome plays at the set BPM (120 by default), accented on beat 1.
3. The player presses Space (or any letter) or clicks / taps along with **what they hear**.
4. Each input is matched to the nearest beat and its offset recorded (positive late, negative early).
5. Live statistics per input type × conversion method, with a suggested calibration.
6. "Export JSON" downloads the device info and every input, for comparing devices.

Switching to a background tab stops the test.

## Time conversion

Beat time = metronome start + beat index × (60 / BPM) on the `AudioContext` timeline (s); every click is booked with `AudioBufferSourceNode.start(beat time)`.

Input times start from `event.timeStamp` (on `performance.now()`'s timeline) and are converted to "the audio the speakers were playing at that moment":

- **Method A (getOutputTimestamp)**: a `{contextTime, performanceTime}` pair says audio at `contextTime` is leaving the speakers at `performanceTime`.
  `heard time = contextTime + (event.timeStamp − performanceTime) / 1000`
- **Method B (currentTime − latency)**: read `currentTime` and `performance.now()` in the callback.
  `heard time = currentTime − (performance.now() − event.timeStamp) / 1000 − baseLatency − outputLatency`

`offset = heard time − nearest beat time`.

Method A should be more accurate (unaffected by `currentTime` updating in blocks); B is for comparison. Both already remove the output latency the browser knows about; what remains (unknown latency such as some Bluetooth headphones, display and input devices, the player's habit) is what calibration removes.

## Statistics and suggested calibration

- Per group: count, mean, median, standard deviation.
- Suggested calibration: the median after dropping the first 4 inputs (finding the beat) and the earliest and latest 10%.
- The offset bar is visual only, fixed at ±150 ms, and **is not a judgement window**.

## Code

| Path | Contents |
| --- | --- |
| `prototypes/latency/index.html` | Page entry (`/prototypes/latency/` on the dev server) |
| `src/audio/` | Audio clock, click synthesis, metronome (reused by the game) |
| `src/rhythm/` | Beat ↔ time conversion (pure, unit tested) |
| `src/latency/` | Offset statistics (pure, unit tested) |
| `src/prototypes/latency/` | The page's UI code |

## Test log

(Log measurements here: device, browser, headphones, each method's median and spread, conclusion.)

| Date | Device / OS | Browser | Output | Input | Method A median / SD | Method B median / SD | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
