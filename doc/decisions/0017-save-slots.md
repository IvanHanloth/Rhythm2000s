# 0017 Three save slots picked on the title screen

- Status: Accepted
- Date: 2026-10-25

## Context

The user asked for saves: on the title screen the player chooses to load one of several saves or to start a new one. Until now progress lived in separate local-storage entries (best scores, finished charts, the Rickroll message, the guide booklet) shared by everyone using the browser, next to device settings and imported charts. Players who already have progress must keep it. Design: [save-slots.md](../save-slots.md).

## Options

How many saves and how they're managed:

1. Three fixed slots, named, renamable and deletable.
2. Three fixed slots named "Save 1–3", deletable only.
3. An unlimited list.

What belongs to a save:

1. Progress only; settings and imported charts are shared by the device.
2. Progress plus "Skip tutorial" and the Beat Guide; calibration and imported charts shared.
3. Everything except calibration, imported charts included.

The title screen:

1. "Start" opens one window listing the slots.
2. A menu of Continue / Load Game / New Game / Credits.
3. Slots drawn as floppy disks.

When all slots are full, New Game either asks which save to overwrite or is disabled.

Storage: keep one local-storage entry per value with a slot prefix, or keep all saves in one versioned JSON entry.

## Decision

The user chose three fixed slots with renaming and deleting; progress only per save, with settings and imported charts shared; the Continue / Load Game / New Game / Credits menu; New Game disabled when the slots are full; and "Save 1" as the name of the migrated save. Each slot shows its name, levels finished and last-played date.

All saves go in one versioned JSON entry, `rhythm2000s.saves`: deleting or replacing a save is a single write, there is no half-written state between entries, and a later format change has a version to migrate from.

## Consequences

- One `SaveSlots` object is created at start-up and handed to the street hub and the scenes (`SceneContext.saves`), like the settings and the cheat. `records.ts` and the mailbox's and booklet's own storage go away; they read and write the current save's progress instead.
- A URL into a scene or level needs a current save; without one it goes to the title screen.
- The first visit after the update moves the old entries into slot 1 and deletes them.
- Progress is held in memory and written through, so when storage is blocked a save lasts until the page is reloaded (the booklet already worked this way).
- No runtime dependency is added.
