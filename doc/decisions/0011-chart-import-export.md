# 0011 Chart import and export in the level list

- Status: Accepted
- Date: 2026-10-24

## Context

Charts are JSON files in `assets/public/charts/` ([ADR 0003](0003-chart-data-format.md)). Trying a new chart meant adding a file to the project and running the dev server; players of a built copy couldn't add charts at all, and there was no way to get a chart out of the game.

## Options

Where:

1. **In the level list** (XP Explorer task pane, Mac Finder toolbar): next to where levels are played, in the period look ([ADR 0004](0004-authentic-os-look.md)).
2. **On the 3D street**: one DOM control for both scenes, but outside the systems.
3. **Developer only** (URL or console): no player UI.

Keeping imports: in browser storage, kept after reload; or for the session only.

Same id as a chart already in the game: replace earlier imports but refuse built-in ids; or always refuse.

A chart for the other scene: add it to that scene's computer; or refuse.

## Decision

The user chose option 1, imports saved in browser storage with a delete option for imported levels, re-imports replacing earlier imports (built-in ids refused), and charts for the other scene added to that computer. Rules in [chart-import-export.md](../chart-import-export.md).

- Imported files go through the same validation as built-in charts (`checkChartData`), except that the id needn't match the file name.
- A chart library (`src/game/chart-library.ts`) holds built-in and imported charts with their JSON source, so any chart can be exported as loaded. Scenes get it through `SceneContext.library` and rebuild their level list after an import or delete.
- Import, export and delete use the browser's file picker and downloads; no new dependency.

## Consequences

- Charts can now change while the game runs: the level list, the café computer cards and the level intros follow the library.
- Imported charts live in one browser only; moving them means exporting and importing.
- A game update that changes chart rules can make stored imports fail validation; they are skipped but kept, so a later fix brings them back.
- The Finder toolbar lost its decorative "Computer" and "Home" items to make room.
