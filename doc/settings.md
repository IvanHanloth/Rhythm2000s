# Settings

> Status: Draft. The user asked for a settings page; where it lives and how it looks are not decided.

The only player setting so far is the input calibration, editable in the dev panel (`src/game/settings.ts`, saved in the browser). The user asked for a proper settings page.

## Settings

| Setting | Default | Effect | Status |
| --- | --- | --- | --- |
| Skip tutorial | Off | Levels play the chart in one go without any action demo; Tab during a demo skips the rest of that level's demos (demo rules in [level-design.md](level-design.md#rule-1-the-system-demonstrates-every-action-before-it-is-used)). Lives in the dev panel until the settings page exists | Decided, in the dev panel for now |
| Beat Guide | Off | The `((((O))))` beat cue in a round, toggled with H in a level, see [beat-guide.md](beat-guide.md). Scores set with it on are marked "Beat Guide" | Decided, toggled with H |
| Input latency calibration | 0 ms | Offset subtracted when judging, within ±300 ms; the existing value, to move to the settings page | Exists, to move |

Settings are saved in the browser; when reading or writing fails (private mode etc.) they fall back to their defaults, as the calibration does now.

## Candidates / open questions

> Ideas only, not decided.

- Where the page lives: in the 3D street (title screen menu), on the computer (XP's Control Panel / Mac's System Preferences), or both. The [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB) include a "Settings" board for reference.
- The "Adjust latency calibration…" link in the results window (see [results.md](results.md)) points to the settings page.
- Other possible settings: volume (music / effects), judgement labels, full screen.
