# Chart editor

> Status: Draft. Decision record: [ADR 0012](decisions/0012-in-game-chart-editor.md). The choices under "Decided" are the user's; everything under "Provisional" and "Candidates / open questions" is not settled.

Players and level designers make charts inside the game, on two editor computers in the net café, instead of writing chart JSON by hand. The editor writes the same [chart format](chart-format.md) and puts its charts in the same library as imported charts ([chart-import-export.md](chart-import-export.md)), so a saved chart shows up on that scene's play computer.

## Decided

- **Name**: the program is **HackerEditor** on both systems: making a chart feels like writing a hacker program that makes the windows pop up.
- **Program look**: only the opening is hacker-themed. HackerEditor's window follows the system's own window style, and its timeline is modelled on Windows Movie Maker 2 (Windows XP, 2002) on XP and iMovie 2 (Mac OS X, 2001) in early Aqua on the Mac.
- **Opening**: sitting down at an editor computer plays an animation: a black screen where "Welcome Back Hacker" is typed out letter by letter in green, then it cuts to the desktop with HackerEditor open.
- **Where**: one editor computer per scene in the café, each in the middle-row seat directly behind its scene's play computer ([hub.md](hub.md)). The XP editor makes `windows-xp` charts, the Mac editor `mac-2000` charts.
- **Look**: a program window on the XP / Mac desktop in the period style, drawn in the game canvas like the level list ([ADR 0004](decisions/0004-authentic-os-look.md)), not a modern web panel.
- **Timeline by phrase**: a phrase list plus an editor for the selected phrase, with a call lane above a response lane on a beat grid; this mirrors the `phrases` array of the chart file.
- **Response follows the call**: the response lane always has the call's actions in the call's order (the [scene rules](chart-format.md#scene-rules) require it). Its rhythm starts equal to the call and can be changed on its own.
- **Play and test inside the editor**: watch the computer play from the selected phrase, or play it yourself with judging; Esc goes back to the editor.

## Flow

```
Seated at an editor computer ── E ──► "Welcome Back Hacker" ──► desktop with HackerEditor open ── Play / Test ──► round from the selected phrase
            ▲                              │      ▲                                          │
            │      Esc / the close button  │      └─────────────── Esc / end of round ───────┘
            └──────────────────────────────┘
```

The editor computers open `#editor/<scene>` (e.g. `#editor/windows-xp`). Esc or the window's close button leaves for the café; with unsaved changes a message box asks first.

## Window

```
┌ Untitled - HackerEditor ───────────────────────────────────────────────────────── _ □ × ┐
│ [New] [Open...] [Save]  [Undo] [Redo]  [Play] [Test]  Snap: [1/2] [1/4]  [Import...] [Export...] │
├────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ Phrases                    │ Phrase 3   ☐ Own gap [0] − + beats            [Reset to call] │
│ ┌────────────────────────┐ │             1         2         3         4                   │
│ │ 1 ▪▪▪                  │ │ Call       [i]       [!]                 [x]                   │
│ │ 2 ▪▪                   │ │ Response   [i]          [!]              [x]                   │
│ │ 3 ▪▪▪                 !│ ├─────────────────────────────────────────────────────────────┤
│ └────────────────────────┘ │ Actions: [i] Information box  [!] Warning box  [x] Error box … │
│ [Add][Copy][Delete][Up][Down]├─────────────────────────────────────────────────────────────┤
│ Song                       │ Problems                                                    │
│ Title          [Untitled]  │ ! Phrase 3, call 4: beat 3.5 is too late; …                 │
│ File name      [        ]  │                                                             │
│ BPM            [120] − +   │                                                             │
│ Beats per bar  [4]   − +   │                                                             │
│ Count-in bars, Outro bars, Gap (beats) likewise                                          │
├────────────────────────────┴─────────────────────────────────────────────────────────────┤
│ 4 phrases · 0:42 · 1 problem · not saved        (hints)                                   │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

| Part | Contents |
| --- | --- |
| Toolbar | New, Open, Save, Undo, Redo, Play, Test, the snap step, Import and Export |
| Phrase list | One row per phrase in play order, with a strip of its action icons and a red "!" when it has a problem; Add (after the selected phrase), Copy, Delete, Up and Down. The mouse wheel scrolls it |
| Song | Title, File name (the chart `id`), BPM, Beats per bar, Count-in bars, Outro bars and Gap (the song's `responseGapBeats`); numbers have − and + buttons and can be typed |
| Phrase | The selected phrase: "Own gap" with its gap, "Reset to call", then the call lane and the response lane over one bar of beat grid |
| Actions | Only this scene's actions ([action table](chart-format.md#action-ids)), each with an icon; the one pressed in is what a click in the call lane places |
| Problems | The chart's validation errors, worded for the editor ("Phrase 3, call 2: …"); clicking one selects its phrase and event |
| Status line | Phrase count, chart length, problem count, saved or not, and the last note (saved, opened, test result) |

Two-press actions (`desktop-refresh`, `start-menu`, `menu-apple`, `sheet-save`) draw a bar to their second press half a beat later; `progress-download` and the volume actions draw it to their judged or released beat, so it is visible what space they take in the bar.

## Editing

- **Call lane**: pick an action in the palette, click an empty grid point to place it. Clicking an action selects it (and picks its action in the palette); drag it to move it along the grid; Delete or Backspace removes it, ← → move it by one snap step. Events snap to the grid chosen in the toolbar.
- **Response lane**: shows the call's actions in order. Dragging a response event changes only its beat; the phrase then gets its own `response` array. "Reset to call" drops it again, so `response` is left out of the file when it equals `call`.
- Placing, moving or removing a call event updates the response: a phrase whose response rhythm equals the call keeps following it; one with its own rhythm keeps its other beats and gets the new action at the same beat as in the call.
- To change an action's type, delete it and place the other one.
- ↑ ↓ pick the phrase. Undo and redo cover every edit, one drag being one step.
- **Validation runs on every change** with the same checks as loading and importing (`checkChartData`): field rules, the scene's per-phrase limits and the [timing limits](chart-format.md#timing-limits). Problem events get a red outline.

## Saving and opening

- **Save** puts the chart in the chart library next to imported charts, so it is listed on the scene's play computer after the built-in levels and can be exported or deleted there like any imported level ([chart-import-export.md](chart-import-export.md)). Only a chart without problems can be saved; otherwise a message lists the problems.
- The **file name** is the chart `id`. A built-in level's name is refused. Saving under the name of another saved or imported level asks before replacing it. Changing the file name of a saved chart and saving again keeps the old one and adds a new level.
- **Open** lists the scene's charts in the library. A built-in chart opens as a copy with an empty file name, since built-in levels can't be replaced.
- **Import** opens a chart file from the computer in the editor (validated like any import; a chart for the other system is refused); it joins the library when saved. **Export** downloads the chart as `<file name>.json`, only when it has no problems.
- New, Open and Import ask before dropping unsaved changes.

## Play and test

- **Play** (watch): the computer plays the chart from the selected phrase to the end, call and response both: every response press is made exactly on its beat, so the virtual mouse closes the widgets and the hit sounds play.
- **Test**: the player plays from the selected phrase to the end with normal judging. Demos are not run, there is no results window and nothing is recorded as a best score; the status line shows the counts ("Test: 7 Perfect, 1 Good, 0 Miss").
- Both start with one count-in bar (the chart's own count-in from the first phrase). A chart with problems can't be played; a message lists them.
- Esc, or the end of the round, returns to the editor with the same phrase selected.

## Provisional (first version, all adjustable)

- **Opening timing**: a 0.4 s pause on the black screen, 75 ms a letter, then 1.1 s on the finished line with a blinking block cursor; about 3 s in all. It plays every time HackerEditor opens and can't be skipped. The text is in a console font (Lucida Console, else Courier New).
- **Window title**: on XP "<chart title> - HackerEditor" ("Untitled - HackerEditor" for a new chart), like Notepad; on the Mac just the chart title, as Mac OS X document windows show only the document's name, with "HackerEditor" and File / Edit / Window / Help (decoration) in the menu bar. HackerEditor has a taskbar button on XP but no Dock icon on the Mac, since adding one would move the Dock icons the `dock-bounce` action uses.
- **New chart**: title "Untitled", empty file name, 120 BPM, 4 beats per bar, 1 count-in bar, 1 outro bar, no gap, one empty phrase.
- **Snap**: 1/2 and 1/4 beat; 1/2 at the start.
- **Shortcuts**: Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z) and Ctrl+S, ⌘ on the Mac; Delete / Backspace, arrow keys. Space is not used, to keep it free as rhythm input during Test. Keys typed in a text field stay in the field.
- **Undo**: the last 100 edits; lost when leaving the computer. Unsaved work is not kept anywhere: leaving asks first.
- **XP icons**: the message box icons for the four boxes, My Computer for right-click refresh, Network for the tray balloon, a program window for minimise, the Windows logo for the Start menu, the full Recycle Bin, Internet Explorer for the download and the speaker for the volume control.
- **Mac icons**: System Preferences for the note alert, the caution triangle, iTunes for the stop alert, Safari for the Dock bounce, Mail, TextEdit for the document window, the Apple logo, the full Trash, a document for the save sheet, iChat and the menu bar speaker.
- **Mac widgets**: small (11 pt) Aqua buttons and a tighter group box so the panel fits between the menu bar and the Dock; the palette and snap toggles are square-cornered gel buttons, blue while pressed in.
- **Lane colours**: blue call clips and green response clips, after Movie Maker's timeline.
- Saved charts are labelled like imported ones in the level list.
- Test rounds run at the player's calibration, like any level.

## Out of scope

- Uploading music: rounds use the game's synthesised backing; a chart has no audio file.
- New action types: they come from the action table and the scene code, not the editor.
- Charts for the other scene: each editor computer only makes charts for its own scene.

## Candidates / open questions

> Ideas only, not decided.

- Saving charts with problems as drafts, or keeping unsaved work in browser storage.
- Changing an action's type in place.
- Copying a phrase between charts; a tap-to-record mode that places events from presses in time with the beat.
