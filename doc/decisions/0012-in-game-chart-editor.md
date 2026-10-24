# 0012 An in-game chart editor on its own café computers

- Status: Accepted
- Date: 2026-10-24

## Context

Charts are written by hand as JSON ([ADR 0003](0003-chart-data-format.md)) and can be imported into the game ([ADR 0011](0011-chart-import-export.md)). Writing beats, phrase gaps and paired responses by hand is slow and error-prone, and the timing limits are only found when the chart is loaded. [ADR 0001](0001-tech-stack.md) already expected a simple chart tool to be needed.

## Options

Where: a separate editor page; the play computer's level list; or **dedicated editor computers in the café**.

Look: **a period program window on the XP / Mac desktop**, drawn in the game canvas; or a modern DOM panel (quicker to build, outside the period look of [ADR 0004](0004-authentic-os-look.md)).

Timeline: **a phrase list plus one phrase at a time** (call lane over response lane, matching the chart file); or one long timeline of the whole song (closer to music software, but not how the data is shaped).

Response: **actions follow the call, rhythm editable**; or the response always equals the call (simpler, but no "show one rhythm, ask for another").

Testing: **play and test inside the editor**; or save and walk to the play computer.

## Decision

The user chose the options in bold: two editor computers in the café, each behind its scene's play computer ([hub.md](../hub.md)); a period program window per system; a phrase-by-phrase timeline; response actions tied to the call with their own rhythm; play and test from the selected phrase inside the editor. The program is called HackerEditor on both systems and opens after "Welcome Back Hacker" is typed out in green on a black screen. Design in [chart-editor.md](../chart-editor.md).

- The editor writes ordinary chart JSON and validates with the same `checkChartData` as loading and import.
- Saved charts go into the chart library of ADR 0011 next to imported charts, so they are played, exported and deleted the same way.

## Consequences

- The editor depends on the chart library from ADR 0011.
- Two editor windows to build, one per system, sharing the editing logic (as the settings and results windows share theirs).
- Validation messages need wording that points at a phrase and beat, not only a JSON field path.
- Rounds need to start from any phrase and run without demos or records, for Play and Test.
- Two more seats in the café become interactive machines.
