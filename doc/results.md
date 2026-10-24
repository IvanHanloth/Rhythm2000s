# Results: the score window after a round

> Status: Draft

After a round, a results window opens in the computer's own system (title "Results — song title", buttons "Retry", "Levels", "Next Level"): a Luna window on XP machines, an Aqua window on Macs. Its look follows the "Results" board of the [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB); the code is `src/ui/results-panel.ts` (content shared by both) and each scene's `results-window.ts`.

## Contents

| Area | Contents |
| --- | --- |
| Rating | A large stamp set at an angle: "Superb", "OK" or "Try again", in the Perfect / Good / Miss judgement colours |
| Comments | Up to three, generated from the round (see below) |
| Score | A five-digit score; "New record" beside it when it beats the chart's previous best; a "Beat Guide" tag at the top left when the beat guide was on during the chart ([beat-guide.md](beat-guide.md#recording-scores)) |
| Counts | Perfect! / Good / Miss boxes with their counts |
| Timing | Every hit sorted by offset into 13 bars of 20 ms (the whole Good window, 130 ms either side of the beat), with a dashed line on the beat; bars centred within Perfect use the Perfect colour, the rest the Good colour. The average early / late offset in ms at the top right |
| Buttons | "Retry", "Levels", "Next Level"; Next Level is the default. On the last level in the list it is disabled and Retry becomes the default |

Keys: Enter / Space press the default button, R retries, Esc returns to the level list ([level-select.md](level-select.md)).

## Provisional rules (first version, all adjustable)

The design only shows the look, not the rules; this is the first version, to be tuned after play-testing.

- **Score**: Perfect is 1 point, Good 0.5, Miss 0; divided by the total and multiplied by 10000, rounded.
- **Rating**: "Superb" from 8000, "OK" from 6000, otherwise "Try again" (after Rhythm Heaven's three tiers).
- **New record**: each chart's best score is saved in the browser; a score above 0 that is the first or beats the previous best is a new record. A new record set with the beat guide on is saved with a flag ([beat-guide.md](beat-guide.md#recording-scores)).
- **Comments**:
  1. An overall line for the rating.
  2. With Misses, the phrases they were in (up to 3); without, "No mistakes.".
  3. When the average hit offset is over 20 ms (with at least 4 hits), a note that timing runs early / late and a suggestion to recalibrate; otherwise that the timing shows no clear bias.
- The design's "Adjust latency calibration…" link is not built; the calibration is set in the settings window ([settings.md](settings.md)).
