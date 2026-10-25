# Settings

> Status: Draft. The window's layout and the calibration step are a first pass, to tune after play-testing.

Player settings live in a settings window on the in-game computer, opened from each system's own menu while the level list is up ([level-select.md](level-select.md)). Values are kept in `src/game/settings.ts` and saved in the browser for the whole device, shared by every save slot ([save-slots.md](save-slots.md)); when reading or writing fails (private mode etc.) they fall back to their defaults.

## Opening it

| Scene | Menu | Window |
| --- | --- | --- |
| Windows XP | "start" → "Control Panel" (right column, above "Printers and Faxes") | "Rhythm 2000s Settings", a Luna dialog |
| Mac | Apple menu → "System Preferences…" | "Rhythm 2000s Preferences", an Aqua window |

- The Start button and the Apple only open their menus on the level list; during a round the menus belong to the chart's actions.
- A click outside an open menu, or Esc, closes it. XP's "Log Off" and "Turn Off Computer" and the Mac's "Shut Down…" and "Log Out…" leave the computer for the café, like Esc on the level list ([level-select.md](level-select.md)). The menus' other items close the menu and do nothing else.
- While the settings window is open the level list is inactive. "OK", the close button, Enter / Return or Esc close it. Changes apply and are saved at once; there is no Cancel.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| Input latency calibration | 0 ms | Offset subtracted when judging, within ±300 ms; positive means the player presses late. A slider, with ← / → for 1 ms steps, and a "Test Latency…" button that opens the system's [latency test](latency-test.md), which can set it |
| Skip tutorial | Off | Levels play the chart in one go without any action demo; Backspace during a demo skips the rest of that level's demos (demo rules in [level-design.md](level-design.md#rule-1-the-system-demonstrates-every-action-before-it-is-used)) |
| Beat Guide | Off | Whether levels show the `((((O))))` beat cue, see [beat-guide.md](beat-guide.md). The same saved value H toggles in a level, so the check box and H always agree. Scores set with it on are marked "Beat Guide" |

## Keyboard shortcuts

The window lists every shortcut in the game (texts in `src/game/shortcuts.ts`):

| Where | Key | Does |
| --- | --- | --- |
| Street | W A S D / arrow keys | Walk |
| | Shift | Run |
| | Mouse | Look around (click the screen first) |
| | E | Examine; sit down at a computer; continue a conversation |
| | Enter | Start, on the title screen |
| | Esc | Pause; stand up when seated |
| Level list | Arrow keys | Select a level |
| | Enter | Play the selected level |
| | Esc | Back to the café |
| In a level | Space / click | Do the action |
| | H | Beat Guide on / off |
| | Backspace | Skip the remaining practice (not Tab, which browsers take for moving focus) |
| | Esc | Back to the level list |
| Results | Enter | Next Level (Retry on the last level) |
| | R | Retry |
| | Esc | Back to the level list |

## Development shortcuts

There is no dev panel. Scenes and levels open straight from the URL (`#windows-xp`, `#mac-2000/<chart id>`, `#street`), see AGENTS.md.

## Candidates / open questions

> Ideas only, not decided.

- The "Adjust latency calibration…" link in the results window (see [results.md](results.md)) could open this window.
- A settings board on the title screen in the street as well (the [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB) have one for reference).
- Other possible settings: volume (music / effects), judgement labels, full screen.
