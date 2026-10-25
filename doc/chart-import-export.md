# Chart import and export

> Status: Draft. Decision record: [ADR 0011](decisions/0011-chart-import-export.md).

Players can bring their own charts into the game and take any chart out of it, from the level list on the in-game computer ([level-select.md](level-select.md)). Files are chart JSON in the [chart format](chart-format.md), the same as the files in `public/charts/`. Charts saved in HackerEditor ([chart-editor.md](chart-editor.md)) are stored and listed the same way as imported ones.

## Where

| | XP Explorer | Mac Finder |
| --- | --- | --- |
| Import | Task pane "Level Tasks" → "Import a level" | Toolbar "Import" |
| Export | Task pane → "Export this level" | Toolbar "Export" |
| Delete | Task pane → "Delete this level", shown only when an imported level is selected | Toolbar "Delete", dimmed unless an imported level is selected |

The Finder toolbar's "Computer" and "Home" items made room for these three; they did nothing.

## Import

- Opens the browser's file picker for one `.json` file.
- The file is validated exactly like a chart in `public/charts/` ([chart-format.md](chart-format.md#validation)): format, scene rules and timing limits. One difference: the `id` doesn't have to match the file name, since browsers rename repeated downloads (`xp-blue-screen (1).json`).
- A chart that fails shows an error message (XP error box "Import Failed", Mac stop alert) with up to 5 of its errors; every error is printed to the browser console.
- **Same id**: a chart whose `id` matches a built-in chart is refused. One that matches an earlier import replaces it in place, so a chart can be edited and re-imported.
- **Other scene**: a chart for the other computer's scene (e.g. a Mac chart imported on the XP machine) is added to that computer; the message says where it went.
- On success an information message names the level, and the level list selects it when it belongs to this computer.
- Imported charts are saved in the browser (local storage) and stay after a reload. They are listed after the built-in levels, in the order they were first imported. If the browser refuses to save (storage full or blocked), the import fails with a message.

## Export

Downloads the selected level's chart, built-in or imported, as `<id>.json`: the chart's JSON as loaded, indented by 2 spaces. The file can be imported again, or added to `public/charts/` and listed in `index.json`.

## Delete

Imported levels only. A confirmation comes first (XP "Confirm Level Delete" with Yes / No, Mac alert with Cancel / Delete); then the chart is removed from browser storage and the list selects the level in its place.

## Message boxes

Message boxes sit over the level list like the settings window: Enter presses the default button (OK, Yes, Delete), Esc closes (No, Cancel). They play the system's own alert sounds: XP's Asterisk for information, Critical Stop for errors, Exclamation for the delete question; on the Mac Glass, Basso and Funk.

## Start-up

Stored imports are validated again at start-up, after the built-in charts. One that no longer passes (a game update tightened a rule, or a new built-in chart took its id) is left out with its errors in the console, but stays in storage so it isn't lost.

## Provisional (first version, all adjustable)

- Best scores are keyed by chart id, as for built-in charts: re-importing a chart keeps its best score, and deleting an imported level keeps it too (importing it again brings it back).
- Imported levels show "Imported level" in the XP Details and as the kind line of the Mac Info window; they look the same in the tiles and icons.

## Candidates / open questions

> Ideas only, not decided.

- Importing several files at once, or by dropping files on the window.
- Sharing a chart by link.
