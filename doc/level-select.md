# Level select: the level list on the computer

> Status: Draft

Sitting at a computer in the net café and pressing E pushes the camera into the screen and into that computer's system, which shows a level list to pick from with the mouse ([hub.md](hub.md)). XP machines show Explorer (window title "My Levels"), Macs show the Finder (also "My Levels"). Interface text is English, as in the original English versions. The look follows the "Level select · XP Explorer" and "Level select · Mac Finder" boards of the [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB), with widgets at each scene's original size ([scenes/windows-xp.md](scenes/windows-xp.md), [scenes/mac-2000.md](scenes/mac-2000.md)).

## Decided

- Switching between XP and Mac means walking to the other computer in the 3D street, so the design's "Other scenes: XP desktop / Mac desktop" in Explorer's task pane is not built.
- Levels can be picked with the mouse.

## Flow

```
Seated in café ── E ──► level list on the computer ── double-click / "Start" ──► level
      ▲                     │        ▲                                          │
      │      Esc / "Back"   │        └──────── Esc / "Levels" on the results ───┘
      └─────────────────────┘
```

- Esc in a level or on the results returns to the level list. Esc, "Back" or the system menu's log-off and shut-down items on the level list return to the café seat.
- Leaving the tab aborts the round and returns to the level list.

## Controls

| Action | XP Explorer | Mac Finder |
| --- | --- | --- |
| Select a level | Click its icon | Click its icon |
| Start | Double-click the icon, or "Play this level" in the task pane | Double-click the icon, or "Start" in the Info window |
| Back to the café | Toolbar "Back", or "start" → "Log Off" / "Turn Off Computer" | Toolbar "Back", "Back" in the Info window, or Apple menu → "Shut Down…" / "Log Out…" |
| Settings ([settings.md](settings.md)) | "start" → "Control Panel" | Apple menu → "System Preferences…" |
| Import / export / delete a chart ([chart-import-export.md](chart-import-export.md)) | "Import a level", "Export this level", "Delete this level" in the task pane | Toolbar "Import", "Export", "Delete" |
| Keyboard | Arrow keys select, Enter starts | Same |

Clicks on the level list never count as rhythm input, and Space doesn't start a level, to avoid accidents. Once a round starts, Space or a click anywhere is rhythm input as usual.

## Provisional (first version, all adjustable)

- **The level list is every chart of the computer's scene** (charts in `public/charts/` with that `scene`, in `index.json` order, then the player's imported charts, see [chart-import-export.md](chart-import-export.md)). The design's locked "???" levels, best rating and high score are placeholders: unlocking and records aren't decided ([hub.md](hub.md) "Open questions"), so they aren't shown.
- The design's task pane links "View best scores" and "Calibrate latency" are not built; settings open from the system menu, see [settings.md](settings.md).
- Level details: song title, actions used, tempo (BPM), phrase count, length.
- Icons: the chart's `icon` when it sets one (any system icon of the scene, see [chart-format.md](chart-format.md#icon-ids); HackerEditor picks it, [chart-editor.md](chart-editor.md)). Without one they follow the chart's actions: one action's icon when it uses one, a "remix" icon when it mixes several (a program window on XP, iTunes on Mac).
- A results window follows each round, with retry, back to the list or straight to the next level, see [results.md](results.md).
