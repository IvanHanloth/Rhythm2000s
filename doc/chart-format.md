# Chart format

> Status: Draft (format version 1). Decision record: [ADR 0003](decisions/0003-chart-data-format.md).

## Files

```
public/charts/
├── index.json          # Chart index
└── xp-popup-mvp.json   # One file per chart, named <chart id>.json
```

The game downloads `index.json` at start-up, then every chart it lists, and validates them. Edited charts take effect on reload, without a rebuild.

### index.json

```json
{
  "format": 1,
  "charts": ["xp-popup-mvp.json"]
}
```

## Chart file

```json
{
  "format": 1,
  "id": "xp-popup-mvp",
  "title": "Pop-up Sweep",
  "scene": "windows-xp",
  "bpm": 120,
  "beatsPerBar": 4,
  "countInBars": 1,
  "outroBars": 1,
  "phrases": [
    {
      "call": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1, "action": "dialog-warning" },
        { "beat": 2, "action": "dialog-error" }
      ]
    },
    {
      "responseGapBeats": 4,
      "call": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1, "action": "dialog-info" }
      ],
      "response": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1.5, "action": "dialog-info" }
      ]
    }
  ]
}
```

### Top-level fields

All required unless marked optional; unknown fields are errors (so a misspelt field isn't silently ignored).

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | integer | Format version, currently `1` |
| `id` | string | Chart id: lowercase letters, digits and hyphens; must match the file name |
| `title` | string | Song title shown to the player |
| `scene` | string | Scene: `windows-xp` or `mac-2000` |
| `bpm` | number | Beats per minute, above 0 |
| `beatsPerBar` | integer | Beats per bar, above 0 |
| `countInBars` | integer | Count-in bars at the start, 0 or more |
| `outroBars` | integer | Empty bars at the end, 0 or more |
| `responseGapBeats` | number (optional) | Beats between the call bar and the response bar, 0 or more; **0 when omitted** (the response follows the call directly). Phrases can override it |
| `phrases` | array | Phrases in play order, at least one |

### Phrases

Each phrase is a call bar, a gap (`responseGapBeats`), then a response bar. Phrases follow each other with no space: the next call bar starts right after the previous response bar.

The gap gives the player time to get ready: "Your turn" is already showing and what the call left on screen (such as open windows) stays; the backing keeps only the hi-hat. Call and response bars each restart the drums on their first beat, so even a fractional gap (e.g. 0.5) keeps the response on the drum grid.

| Field | Required | Meaning |
| --- | --- | --- |
| `call` | yes | Events in the call bar, at least one |
| `response` | no | Events in the response bar (the player's targets), at least one. **Same as `call` when omitted** |
| `responseGapBeats` | no | This phrase's gap, overriding the top-level value |

### Events

| Field | Type | Meaning |
| --- | --- | --- |
| `beat` | number | Position from the **start of its bar**, from 0 and below `beatsPerBar`. Fractions allowed: `1.5` is the off-beat of beat 2 |
| `action` | string | Action ID, see below |

Events in a bar are in ascending `beat` order with no duplicates.

Some actions take two presses, or are judged later than their beat (`progress-download` waits 3 beats); see the "Response" column below. Such an event occupies the bar from its `beat` to its last press:

- the next event's `beat` must come after this event's last press;
- the last press must still fall inside the bar (below `beatsPerBar`).

### Action IDs

An action ID names **the widget that appears in the call**, after the original system's class or constant ([ADR 0006](decisions/0006-actions-named-after-ui-classes.md)):

- Written `<widget>-<variant>`, lowercase and hyphenated, e.g. `dialog-info`.
- Widget and variant come from the original: XP's `MB_ICONINFORMATION` → `dialog-info`, `MB_ICONERROR` → `dialog-error`. Names match the icon file names in `assets/reference/`.
- Not verbs (no `close-window`); what the player does with the widget is in the "Response" column.

| Action ID | Widget | Scene | Call | Response |
| --- | --- | --- | --- | --- |
| `dialog-info` | Information message box (blue i) | `windows-xp` | Pops up on the beat with XP's Asterisk sound | Close it on the beat |
| `dialog-warning` | Warning message box (yellow !) | `windows-xp` | Pops up on the beat with XP's Exclamation sound | Close it on the beat |
| `dialog-error` | Error message box (red ×) | `windows-xp` | Pops up on the beat with XP's Critical Stop sound | Close it on the beat |
| `dialog-question` | Question message box (?, Yes / No) | `windows-xp` | Pops up on the beat with `chimes.wav` (the original Question event is silent, see [scenes/windows-xp.md](scenes/windows-xp.md#sounds)) | Close it on the beat |
| `desktop-refresh` | "Refresh" in the desktop context menu (window class `#32768`) | `windows-xp` | The virtual mouse right-clicks the desktop on the beat and **half a beat later** clicks Refresh; the icons blink | Two presses: on the beat (right-click) and half a beat later (Refresh) |
| `balloon-info` | Tray balloon (`Shell_NotifyIcon`, `NIIF_INFO`) | `windows-xp` | A balloon rises from the tray on the beat with `Windows XP Balloon.wav` | Click its close button on the beat |
| `window-minimize` | A program window's minimise button (`SC_MINIMIZE`) | `windows-xp` | A Notepad, Paint or similar window opens on the beat with a new taskbar button and `Windows XP Restore.wav` | Minimise it on the beat, with `Windows XP Minimize.wav` |
| `start-menu` | Start menu | `windows-xp` | The virtual mouse clicks Start on the beat and **half a beat later** a program; the menu closes | Two presses: on the beat (Start) and half a beat later (the item) |
| `recycle-bin` | Recycle Bin (`SHFileOperation`, `FO_DELETE`) | `windows-xp` | A file lands on the desktop on the beat with `Windows XP Default.wav` (provisional) | Throw it in the bin on the beat, with `Windows XP Recycle.wav` |
| `progress-download` | IE6 download window (`msctls_progress32`) | `windows-xp` | Opens on the beat; the bar fills over **3 beats** and the virtual mouse clicks Open as it fills | The window opens by itself on the beat; click **3 beats later** as the bar fills |
| `volume-mute` | Tray volume control (`msctls_trackbar32`); visual only | `windows-xp` | The pop-up opens before the beat; the virtual mouse grabs the slider on the beat and drags it to 0 over **1 beat**, releasing on the beat | The slider starts at 0; press on the beat (the only judged press), then the slider returns over 1 beat and releases by itself |
| `alert-note` | Mac note alert (`kAlertNoteAlert`, application icon) | `mac-2000` | Pops up on the beat with `Glass` | Click OK on the beat |
| `alert-caution` | Mac caution alert (`kAlertCautionAlert`, yellow triangle) | `mac-2000` | Pops up on the beat with `Funk` | Same |
| `alert-stop` | Mac stop alert (`kAlertStopAlert`) | `mac-2000` | Pops up on the beat with `Basso` | Same |
| `dock-bounce` | Bouncing Dock icon (`requestUserAttention:`) | `mac-2000` | The icon jumps and lands on the beat with `Pop`, then keeps hopping | Click it on the beat to stop it |
| `mail-new` | New mail (Mail's Dock badge) | `mac-2000` | Mail hops and its badge goes up by one, with `Ping` | Read one on the beat; the badge goes down |
| `window-miniaturize` | Mac document window (`NSWindow miniaturize:`) | `mac-2000` | A window opens on the beat with `Bottle` | Minimise it to the Dock on the beat |
| `menu-apple` | Apple menu (`NSMenu`, the Apple at the far left of the menu bar) | `mac-2000` | The virtual mouse clicks the Apple on the beat with `Morse`; **half a beat later** an item, with `Tink`; the menu closes | Two presses: on the beat (Apple) and half a beat later (item) |
| `dock-trash` | Trash in the Dock (`NSWorkspaceRecycleOperation`) | `mac-2000` | A file lands above the Dock on the beat with `Purr` | Throw it in the Trash on the beat, with `Blow`; the Trash turns full |
| `sheet-save` | Save sheet of a document window (`NSWindow beginSheet:`) | `mac-2000` | A window opens before the beat; the virtual mouse clicks close on the beat and the sheet slides out with `Frog`; **half a beat later** "Don't Save", with `Tink`; the window closes | Another window opens in the same place; two presses: on the beat (close) and half a beat later (Don't Save) |
| `ichat-message` | iChat message window | `mac-2000` | Pops up above iChat in the Dock on the beat with `Submarine` | Click it on the beat; it shrinks back into iChat |
| `menu-volume` | Menu bar volume extra (`NSMenuExtra`); visual only | `mac-2000` | The volume menu drops before the beat with the slider at the bottom; the virtual mouse grabs it on the beat (`Tink`) and drags it to the top over **1 beat**, releasing (`Pop`) | Press on the beat; the game releases 1 beat later, only the press is judged (as `volume-mute`) |

Actions of a scene can be mixed freely within a phrase. Two-press actions (`desktop-refresh`, `start-menu`, `menu-apple`, `sheet-save`) have their second press fixed half a beat after the first, and the chart only gives the first beat. `progress-download` is judged at +3 beats; the volume actions are pressed at 0 and released by the game at +1. Designs for the XP actions are in [scenes/windows-xp-levels.md](scenes/windows-xp-levels.md), the Mac sounds in [scenes/mac-2000.md](scenes/mac-2000.md#sounds). Other designed actions (XP mail etc.) join this table when implemented. A chart using an action its scene doesn't support is an error.

## Official levels

Official levels also follow [level-design.md](level-design.md): easy to hard, at least 1 minute of chart. The opening demo is generated from the chart's actions — **don't write it in the chart**.

## Scene rules

| Scene | Rules |
| --- | --- |
| `windows-xp` | Each phrase's `response` has as many events as its `call`, with the same actions in order: the n-th box to appear is closed by the n-th press. Per phrase at most 6 message boxes and program windows together, 4 `window-minimize`, 3 `balloon-info` and 6 `recycle-bin` ([why](scenes/windows-xp-levels.md#per-phrase-limits)) |
| `mac-2000` | The same pairing. Per phrase at most 6 alerts and document windows together (`sheet-save` windows included), 8 `dock-bounce`, 6 `dock-trash` and 3 `ichat-message` (that's all the screen slots and Dock icons there are) |

## Timing limits

The "Follow me / Your turn" banner switches half a beat before the call and response bars end ([prototypes/mvp.md](prototypes/mvp.md#turn-cue)), so the last press in either bar must have its Good window closed by then. At 120 BPM with Good ±100 ms the last press is at beat 3.25 at the latest; two-press actions start by 2.75, the volume actions by 2.25 and `progress-download` by 0.25. Charts that break this fail validation.

## Validation

Charts are validated at start-up; a chart with errors is skipped and its errors are printed to the browser console with field paths, e.g.

```
Chart xp-popup-mvp.json: phrases[2].call[1].beat must be greater than the previous event's beat
```
