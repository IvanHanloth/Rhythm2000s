# Save slots

> Status: Draft

The player keeps their progress in one of three save slots, picked on the title screen. Decision record: [ADR 0017](decisions/0017-save-slots.md).

## Decided

### What a save holds

Each save holds one player's progress:

| Progress | Used by |
| --- | --- |
| The difficulty ([difficulty.md](difficulty.md)) | Every level's speed and recorded score; the settings window |
| Best score per chart, the difficulty it was set on, and whether it was set with the beat guide on | Level intro, results window, the café card's "Played: N / M levels" ([results.md](results.md), [beat-guide.md](beat-guide.md#recording-scores)) |
| The charts played to their results window | Rickroll unlock, the street's second objective ([easter-eggs.md](easter-eggs.md), [hub.md](hub.md#objectives)) |
| Whether the Rickroll message has been read | The mail program's unread mark ([easter-eggs.md](easter-eggs.md)) |
| Whether the guide booklet has been opened | The street's first objective ([hub.md](hub.md#objectives)) |
| Name and last-played date | The save list |

Everything else belongs to the device and is shared by all saves:

- Settings: latency calibration, "Skip tutorial" and the Beat Guide ([settings.md](settings.md)).
- Imported charts and the charts saved in HackerEditor ([chart-import-export.md](chart-import-export.md), [chart-editor.md](chart-editor.md)).
- The cheat code stays in memory only, as before ([cheat-code.md](cheat-code.md)).

### Slots

- There are **three fixed slots**, numbered 1 to 3.
- A save is named when it is created, and can be **renamed** and **deleted** later. Names are 1–16 characters after trimming spaces; two saves may share a name.
- A new save's suggested name is "Save N", where N is its slot number.
- Deleting asks for confirmation first and can't be undone.

### Title screen

The title menu reads, top to bottom:

| Item | When | What it does |
| --- | --- | --- |
| **Continue: *name*** | Only while the save played last still exists | Loads that save and starts on the street |
| **Load Game** | Disabled while every slot is empty | Opens the "Load Game" window |
| **New Game** | Disabled while all three slots are full ("All three save slots are in use. Delete one in Load Game first.") | Opens the "New Game" window |
| **Credits** | Always | As before ([hub.md](hub.md)) |

Enter or Space on the title screen picks the first item that is shown and enabled (Continue, else New Game, else Load Game). The windows are XP-style DOM windows over the street, in the same Luna look as the café's level card. Esc closes the open window.

**Load Game** lists the three slots. A filled slot shows its name, "Finished N of M levels" and "Last played 25 Oct 2026", with the buttons **Load**, **Rename** and **Delete**; an empty slot reads "Empty slot".

- **Load** makes it the current save and starts on the street.
- **Rename** turns the name into a text field with **OK** and **Cancel**; Enter confirms, Esc cancels.
- **Delete** asks "Delete *name*? This can't be undone." with **Delete** and **Cancel** in the slot's row.

**New Game** asks for a name ("Save N" filled in) and a difficulty (five radio buttons, Heaven to Hell, Normal picked at first; [difficulty.md](difficulty.md#choosing-it)) and goes into the first empty slot. **Start** creates the save, makes it current and starts on the street; **Cancel** goes back to the menu.

"Quit to title" in the pause menu returns here, so the player can switch saves. The character stays where they were on the street: their position is not part of a save.

### Counting and dates

- **Finished N of M levels**: N is how many of the save's finished charts are still among the levels on this device (built-in and imported), M is how many levels there are. Since imported charts are shared, deleting one lowers both numbers for every save.
- **Last played** is set to the day a save is created or loaded, and the day it finishes a chart. It shows as day, short English month and year ("25 Oct 2026"), the same in every browser language.

### Current save

- The save loaded last is remembered. A refresh, or a URL that opens a scene or a level (`#mac-2000`, `#windows-xp/xp-dial-up`, `#editor/mac-2000`), plays on that save.
- With no current save (none created yet, or the last one deleted) such a URL goes to the street's title screen instead.

### Existing players

Progress saved before save slots existed moves into **slot 1, "Save 1"** on Normal, which becomes the current save, with today as its last-played date. This happens once, on the first visit after the update; the old storage entries are removed afterwards. A player with no earlier progress starts with three empty slots.

### Storage

All saves live in one local-storage entry, `rhythm2000s.saves`, a versioned JSON object (`version`, the current slot, and the three slots, empty ones as `null`). Version 2 added the save's difficulty and each best score's difficulty; a version 1 entry is read as Normal throughout and written back as version 2. When the browser refuses storage (private mode etc.) saves work until the page is reloaded. An entry that can't be read is logged, copied to `rhythm2000s.saves.unreadable` so it isn't lost, and the game starts with empty slots.

## Code

- `src/game/save-slots.ts`: the slots, the current save, reading and writing the entry, the migration.
- `src/game/save-progress.ts`: one save's progress (best scores, finished charts, the message, the booklet).
- `src/hub/save-windows.ts`: the title screen's Load Game and New Game windows.
- Scenes reach the current save through `SceneContext.saves`.

## Open questions

- [ ] Exporting or importing a save file, for moving progress to another browser.
- [ ] Play time per save.
