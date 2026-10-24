# 0010 The latency test moves into the game, one per system

- Status: Accepted
- Date: 2026-10-24

## Context

Calibration was measured on a stand-alone prototype page (`/prototypes/latency/`) linked from the title screen. It was built to answer research questions (raw device numbers, two conversion methods side by side, JSON export), looked nothing like the game, and sent the player out of it. The calibration it suggested then had to be typed into the settings window by hand.

## Options

1. **Keep the prototype page** and link it from the settings window: no new work, but still outside the game and its look.
2. **One shared test screen** for both scenes: one build, but in neither system's look ([ADR 0004](0004-authentic-os-look.md)).
3. **A test window per system**, opened from that system's settings window, sharing the counting and statistics: fits each scene and can set the calibration directly.

Flow: a fixed run (count-in, then a set number of beats) or a metronome that runs until stopped.

## Decision

- Option 3, as asked by the user, following the "Settings · latency calibration" board of the [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB): XP and Mac each get a "Latency Test" window opened from their settings window.
- A fixed run: 4 count-in clicks, then 8 measured clicks at 120 BPM; "Use Suggested Value" sets the calibration. Details in [latency-test.md](../latency-test.md).
- The prototype page and its "Latency test" button on the title screen are removed; so is the title screen's "Controls" panel, as the settings window lists every key.

## Consequences

- The run logic and statistics are pure code in `src/latency/`, shared by both windows; each scene draws its own window and widgets.
- Research measurements (method A vs B, raw `outputLatency`) no longer have a page; the test log in [latency-test.md](../latency-test.md) records the in-game test's suggestion and spread instead.
- The metronome class, only used by the prototype, goes with it.
