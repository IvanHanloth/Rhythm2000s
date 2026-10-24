# Scene: the Windows XP desktop

> Status: Draft

## Look

The Bliss wallpaper, the blue taskbar, the green "start" button, rounded blue title bars — as close to the original as possible, using the original assets in `assets/reference/windows-xp/` ([ADR 0004](../decisions/0004-authentic-os-look.md)).

## Widgets

The reference is **US English Windows XP SP2 with the Luna blue theme**; interface text follows the English version ("start", "OK", "All Programs", "Log Off", "Turn Off Computer").

### Size

- Widgets are drawn at original pixel size (title bars, buttons, a 30 px taskbar) and the desktop is scaled 1.25× to fill the 1280×720 canvas, like XP at **1024×576**. The scale is provisional.
- The Follow me / Your turn banner and judgement labels aren't part of XP and use canvas coordinates.
- Titles that don't fit are cut off with "..." like the original.

### Widget list

Code in `src/scenes/windows-xp/components/`.

| Widget | Original | Contents |
| --- | --- | --- |
| Desktop | Desktop | Bliss scaled to cover; "My Documents", "My Computer", "My Network Places", "Internet Explorer" down the top left, "Recycle Bin" at the bottom right; 32 px icons with shadowed white labels |
| Taskbar | `Shell_TrayWnd` | 30 px blue gradient bar, the green "start" button (lowercase bold italic, `windows-logo.png` flag), the tray on the right |
| Start menu | XP-style Start menu | Blue user bar (`user.png`) and orange rule; white left column (Internet, E-mail, Windows Media Player, Windows Messenger, Notepad, Paint, Calculator, Minesweeper, "All Programs"); light blue right column (My Documents, My Pictures, My Music, My Computer, My Network Places, Control Panel, Printers and Faxes, Help and Support, Search, Run...); blue footer with "Log Off" and "Turn Off Computer"; hovered items white on blue |
| Tray | `TrayNotifyWnd` | Light blue gradient with network (`network-neighborhood.png`), Messenger, the speaker (`speaker.png`, a red "no" sign when muted) and a 12-hour clock in local time ("5:49 PM") |
| Tray balloon | Balloon `tooltips_class32` | Pale yellow rounded balloon, tail pointing at the tray icon, bold title with an icon, close button at the top right |
| Volume control | The pop-up from the tray speaker | "Volume", a vertical slider with ticks on both sides, a "Mute" check box; releasing the slider beeps at the new volume like the original |
| Pointer | Standard arrow | `icons/default_arrow.cur` (with its own hotspot) |
| Message box | `MessageBox` (window class `#32770`) | Luna title bar (active / inactive) with a close button; 32 px icon left, text right; centred buttons, the default with a blue inner border; sized to its text |

The four message boxes are the four dialog action IDs ([chart-format.md](../chart-format.md#action-ids)):

| Action ID | Original constant | Icon | Buttons |
| --- | --- | --- | --- |
| `dialog-info` | `MB_ICONINFORMATION` | `icons/dialog-info.png` | OK |
| `dialog-warning` | `MB_ICONWARNING` | `icons/dialog-warning.png` | OK |
| `dialog-error` | `MB_ICONERROR` | `icons/dialog-error.png` | OK |
| `dialog-question` | `MB_ICONQUESTION` | `icons/dialog-question.png` | Yes, No |

Box texts imitate period pop-up ads and system notices and are all original ("Congratulations! / You are our 100,000th visitor! Click here to claim your prize.", "Low Disk Space / You are running out of disk space on Local Disk (C:)."…); the full list is `POPUP_TEXTS` in `src/scenes/windows-xp/scene.ts`.

### Level select: Explorer

The scene opens on an Explorer level list picked with the mouse; flow and controls in [level-select.md](../level-select.md).

| Widget | Original | Contents |
| --- | --- | --- |
| Explorer window | `CabinetWClass` | "My Levels" with a folder icon and minimise / maximise / close; menu bar "File Edit View Favorites Tools Help"; standard toolbar (Back, Forward, Up, Search, Folders, Views); address bar "C:\Rhythm 2000s\My Levels\XP Desktop" with "Go"; status bar ("N objects", "Click to select, double-click to play    Esc: back to the café") |
| Task pane | Web view task pane | Blue-purple gradient with collapsible groups: "Level Tasks" (Play this level, Back to the café) and "Details" (title, Actions, Tempo, Phrases, Length) |
| Tiles | View → Tiles | "All Levels" group, 48 px icons with three lines (name, actions, tempo); the selection is white on blue with a blue-tinted icon |
| Taskbar button | Program button | "My Levels"; pressed while the window is in front, released during a round |

The toolbar's Back, Forward, Up and Views icons aren't available locally and are drawn as vectors; Search and Folders use `icons/search.png` and `icons/folder.png`.

### Sounds

All from the original files in `assets/reference/windows-xp/sounds/`. Leading silence is trimmed on load (some files start tens of ms late, which sounds behind the beat) and peaks are normalised.

| When | Original event | File |
| --- | --- | --- |
| `dialog-info` pops up | Asterisk | `Windows XP Error.wav` |
| `dialog-warning` pops up | Exclamation | `Windows XP Exclamation.wav` |
| `dialog-error` pops up | Critical Stop | `Windows XP Critical Stop.wav` |
| `dialog-question` pops up | Question, **silent by default** | `chimes.wav` for now |
| The player closes a box (Perfect / Good) | Closing is silent; Explorer's Start Navigation click | `Windows XP Start.wav` |
| Miss | Default Beep (clicking outside a modal dialog) | `Windows XP Ding.wav` |
| Round ends, results open | — | `tada.wav` |
| Start menu item clicked | Menu Command | `Windows XP Menu Command.wav` |
| Volume slider released | Default Beep | `Windows XP Ding.wav` |
| `desktop-refresh` right-click / Refresh | Silent originally; the navigation click / Menu Command (provisional) | `Windows XP Start.wav` / `Windows XP Menu Command.wav` |
| `balloon-info` appears / closed | Balloon / the navigation click | `Windows XP Balloon.wav` / `Windows XP Start.wav` |
| `window-minimize` opens / minimised | Restore Up / Minimize | `Windows XP Restore.wav` / `Windows XP Minimize.wav` |
| `start-menu` Start / item | Silent / Menu Command | `Windows XP Start.wav` / `Windows XP Menu Command.wav` |
| `recycle-bin` file lands / thrown away | Provisional / Empty Recycle Bin | `Windows XP Default.wav` / `Windows XP Recycle.wav` |

The event column is from memory and scattered sources, not checked against an XP registry (`HKCU\AppEvents\Schemes`).

### Virtual mouse

During a round a virtual XP arrow (decoded from `icons/default_arrow.cur`, hotspot at the tip) moves around and clicks things; it isn't the player's mouse.

Decided:

- **Call**: it demonstrates — moving onto each new box, or right-clicking the desktop on the beat and clicking Refresh half a beat later.
- **Response**: it waits on the next target ahead of time and clicks in place when the player presses Space (or clicks). The player only keeps the rhythm, without aiming.
- Both presses of a two-press action use the same input.
- It exists only during a round; the player's own pointer is hidden then so the two aren't confused.

Provisional:

- Boxes are clicked at the centre of the default button ("OK" or "Yes").
- It arrives "Good window + 1/16 beat" before the target so even the earliest valid press lands on it; in the response it leaves only once the press is judged, in the call 1/16 beat after the beat. Moves take at most half a beat, eased in and out.
- A click shrinks the pointer and shows the button pressed for 1/8 beat.
- It rests right of and below the centre before and after a round.
- **Back to the centre after the call**: halfway between each phrase's last call press and first response press it returns to the centre of the work area, then sets off for the first target, so its move tells the player it's their turn; skipped when the two are less than 0.75 beat apart. The Mac scene shares this (`src/scenes/shared/cursor-path.ts`).

### Desktop context menu and Refresh

| Widget | Original | Contents |
| --- | --- | --- |
| Context menu | Menu window `#32768`, XP flat style | White, 1 px grey border, shadow at the bottom right; items "Arrange Icons By ▶", "Refresh", separator, "Paste", "Paste Shortcut" (disabled), separator, "New ▶", separator, "Properties"; hovered item white on blue; top left at the click |
| Refresh | Desktop "Refresh" | The icons vanish for 1/8 beat and come back, like the original |

`desktop-refresh` (provisional): the right-click spot rotates through fixed empty spots by index in the phrase, the same in call and response. The first press opens the menu (also on a Miss, so the second press can follow); the second clicks Refresh, closing the menu and blinking the icons (a Miss just closes it). The judgement shows above the spot.

### Missing assets

| Missing | Instead |
| --- | --- |
| Luna theme bitmaps (title bars, buttons, Start button, check boxes, sliders from `luna.msstyles`) | Vector gradients in the original colours |
| Icons for "Control Panel", "My Recent Documents", "Set Program Access and Defaults" | "Control Panel" (it opens the [settings](../settings.md)) uses a vector stand-in for its icon; the other two are left out |
| Trebuchet MS for title bars | The system's copy, falling back to Tahoma; the UI uses the local Tahoma |

## Actions

- Message boxes popping up and closing (`dialog-*`)
- Right-click → Refresh (`desktop-refresh`)
- Tray balloon, minimise window, Start menu, Recycle Bin (`balloon-info`, `window-minimize`, `start-menu`, `recycle-bin`) and download window and volume control (`progress-download`, `volume-mute`), designed in [windows-xp-levels.md](windows-xp-levels.md)
- Getting mail (not yet designed)

## Candidates / open questions

> Ideas only, not decided.

- A cascade of error dialogs (the classic error-window trail), closed one by one on the beat
- Pop-up ads multiplying as the tempo rises
- Startup / shutdown sounds opening and closing a phrase
