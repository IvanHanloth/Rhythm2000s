# Windows XP scene: further actions and levels

> Status: Draft. The actions were chosen by the user; beats, sounds, texts and limits are provisional until play-tested.

Beyond popping up and closing message boxes, the XP scene uses the tray balloon, Start menu, minimise button, Recycle Bin, a download window and the volume control, each with a chart, plus a remix level mixing everything. The widgets' look is in [windows-xp.md](windows-xp.md); how to write them in charts in [chart-format.md](../chart-format.md#action-ids).

## Shell actions

Action IDs follow the original widgets ([ADR 0006](../decisions/0006-actions-named-after-ui-classes.md)). As with message boxes, the computer does it in the call and the player handles it on the same beats in the response; the n-th target to appear is handled by the n-th press.

| Action ID | Widget (original) | Call | Response | Presses |
| --- | --- | --- | --- | --- |
| `balloon-info` | Tray balloon (`Shell_NotifyIcon`, `NIIF_INFO`) | A balloon rises from a tray icon on the beat with `Windows XP Balloon.wav` | Click its close button on the beat | 1 |
| `window-minimize` | Program window minimise button (`SC_MINIMIZE`) | A program window (Notepad, Paint, IE…) opens on the beat with a taskbar button and `Windows XP Restore.wav` | Click minimise on the beat; it shrinks into its taskbar button with `Windows XP Minimize.wav` | 1 |
| `start-menu` | Start menu | Start is clicked on the beat and the menu opens; **half a beat later** a program is clicked, the menu closes with `Windows XP Menu Command.wav` | The same two presses | 2 |
| `recycle-bin` | Recycle Bin (`SHFileOperation`, `FO_DELETE`) | A file lands on the desktop on the beat with `Windows XP Default.wav` (provisional) | Throw it into the Recycle Bin on the beat; the bin turns full with `Windows XP Recycle.wav` | 1 |

Windows sit on the desktop while balloons, the Start menu and files sit by the taskbar, so they don't overlap and can be mixed freely.

### Look

| Action | Where | Call | Response hit | Response Miss |
| --- | --- | --- | --- | --- |
| `balloon-info` | Balloons 1–3 point at the network, Messenger and volume tray icons, stacked upwards | Springs out of its tail on the beat | Shrinks and fades | Shakes, stays until the phrase ends, fades |
| `window-minimize` | Shares the 6 screen slots with message boxes; taskbar buttons right of "My Levels" | Grows out of its taskbar button, active title bar | Shrinks into its taskbar button, which pops up | Title bar flashes, stays until the phrase ends, fades |
| `start-menu` | The menu opens upwards from Start | First press: Start pressed, menu opens; second: the item highlights, menu closes | Same | First press missed: no menu; second missed: the menu stays until the phrase ends |
| `recycle-bin` | Files in a row above the taskbar (up to 6), left to right | Drops from above with a small bounce | Arcs into the bin, which turns full | Shakes, stays until the phrase ends, fades |

Each phrase starts with an empty bin and no program buttons.

### Per-phrase limits

There is only so much room on screen; validation checks these ([chart-format.md](../chart-format.md#scene-rules)):

| Targets | Max per phrase | Why |
| --- | --- | --- |
| Message boxes + program windows | 6 | 6 screen slots |
| `window-minimize` | 4 | Room for 4 program buttons besides "My Levels" |
| `balloon-info` | 3 | 3 tray icons |
| `recycle-bin` | 6 | Room for 6 files in the row |

### Texts

All original, in the voice of English XP notices:

- Balloons: "Found New Hardware / USB Mass Storage Device", "Windows Messenger / Jamie has just signed in.", "Automatic Updates / New updates are ready to download.", "Local Area Connection / A network cable is unplugged.", "Security Center / Your computer might be at risk."
- Program windows: "Untitled - Notepad", "untitled - Paint", "about:blank - Microsoft Internet Explorer" (cut off with "..." where it doesn't fit), "Minesweeper"
- Start menu picks in rotation: Notepad, Paint, Minesweeper, Calculator, Windows Media Player, Windows Messenger
- Files: "New Text Document.txt", "Hey Ya!.mp3", "setup.exe", "untitled.bmp", "New Folder", "homework(1).doc"

## Waits and holds: download window and volume control

A download that must be waited for, and a volume slider held to restore the volume (**visual only; the game's volume never changes**). XP only, fixed beat counts, no chart format change.

| Action ID | Widget (original) | Call | Response | Judged at (from the event beat) |
| --- | --- | --- | --- | --- |
| `progress-download` | IE6 download window (`msctls_progress32` bar) | Opens on the beat; the bar fills over **3 beats**, Open lights up and the virtual mouse clicks it as the bar fills; the window closes | The window opens by itself on the beat and fills the same way; the player clicks as it fills | One press at +3 |
| `volume-mute` | Tray volume pop-up (`msctls_trackbar32` slider) | Opens before the beat at the original volume; the virtual mouse grabs the slider on the beat, drags it to 0 over **1 beat** and releases on the beat; the tray speaker shows muted | Opens before the beat at 0 (muted by the call); the player presses on the beat, then the slider returns to the original volume over 1 beat and releases by itself | One judged press at 0; the release at +1 is automatic and unjudged |

- Both are one event with fixed spacing and occupy the bar until their last press; at 120 BPM `progress-download` starts by beat 0.25 and `volume-mute` by 2.25 ([chart-format.md](../chart-format.md#timing-limits)).
- The download window works as a rest: it fills the whole bar, leaving no room for other actions.
- Only the volume press is judged; when the player lets go doesn't matter.
- Call and response drag in opposite directions: the computer mutes, the player restores. The tray speaker shows muted from the call's release until the response's release (or the pop-up closing after a Miss).

### Judging (provisional)

| Case | Result |
| --- | --- |
| Clicking the download before it fills | As any action: earlier than Good but within the early range is a Miss; earlier still does nothing (the disabled button ignores it) |
| `volume-mute` press hit | One judgement; the slider returns over 1 beat and releases at +1 regardless of the player |
| `volume-mute` press missed | One Miss; the slider stays at the bottom and the pop-up shakes and closes |

### Look (provisional)

| Action | Where | Call | Response hit | Response Miss |
| --- | --- | --- | --- | --- |
| `progress-download` | Below the screen centre, over the message boxes | Opens on the beat; the title "N% of setup.exe Completed" follows the green block bar; when full it reads "Download complete", Open lights up, is clicked and the window shrinks away | Same | Title bar flashes, then fades |
| `volume-mute` | Right above the tray speaker | Opens 1/4 beat early at the setting; while held the slider follows the mouse down; on release it is at the bottom, "Mute" ticked, the speaker muted, and the pop-up closes | Opens 1/4 beat early at the bottom with "Mute" ticked; after a hit the slider follows the virtual mouse up, releases at +1, unmutes and closes | The slider drops to the bottom; the pop-up shakes and closes |

Texts: the download window reads "37% of setup.exe Completed" → "Download complete", "setup.exe from www.example-files.com", "Estimated time left: 2 sec", "Download to: C:\\Documents and Settings\\...\\Desktop", with "Open", "Open Folder" and "Cancel" (then "Close"); file names rotate by phrase: `setup.exe`, `song.mp3`, `photos.zip`, `homework.doc`, `game_demo.exe`. The volume control reads "Volume" and "Mute".

### Sounds (provisional)

| When | File |
| --- | --- |
| `progress-download` opens (call and response) | `Windows XP Hardware Insert.wav` |
| `progress-download` Open clicked | `Windows XP Notify.wav` |
| `volume-mute` press | `Windows XP Start.wav` (the click) |
| `volume-mute` release | `chord.wav` — the original slider release is Ding, which is the Miss sound here |

## Levels (charts)

In `public/charts/index.json` order, written to the [level design guidelines](../level-design.md) (rule 4: ten levels, more widgets and a faster tempo each level, then the slower closing medley). Each level has three or four sections of about six phrases; a section starts with the widgets new to it, so the chart stops for demos only there. Balloons and the volume pop-up never share a phrase, since both sit by the tray.

| # | Chart | Title | BPM | Length | Presses | Widgets (by section) | Shape |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `xp-power-on` | Power On | 100 | 20 phrases, 101 s | 72 | `dialog-info`, `balloon-info`; `progress-download` | The gentle opener: whole beats, a few pairs of eighths, downloads as waits |
| 2 | `xp-first-boot` | First Boot | 106 | 24 phrases, 113 s | 104 | `dialog-info`, `dialog-warning`; `recycle-bin`; `progress-download` | Whole beats first, then pairs of eighths; ends simply |
| 3 | `xp-popup-blocker` | Pop-up Blocker | 110 | 24 phrases, 109 s | 117 | `window-minimize`, `dialog-error`; `dialog-question`, `recycle-bin`; `volume-mute` | Browser windows and errors; the first hold (the volume slider) as a breath |
| 4 | `xp-dial-up` | Dial-Up Groove | 114 | 24 phrases, 105 s | 118 | `dialog-question`, `dialog-info`, `balloon-info`; `window-minimize`, `dialog-error`; `progress-download` | Off-beats from the start; downloads between dense phrases |
| 5 | `xp-f5-fever` | F5 Fever | 118 | 24 phrases, 102 s | 128 | `desktop-refresh`, `dialog-info`, `recycle-bin`; `dialog-warning`, `balloon-info`, `dialog-error`; `progress-download` | The first two-press widget, right-click refresh, chained into runs of eighths |
| 6 | `xp-taskbar-shuffle` | Taskbar Shuffle | 122 | 24 phrases, 98 s | 134 | `start-menu`, `dialog-warning`, `recycle-bin`; `volume-mute`, `dialog-question`; `balloon-info`, `window-minimize` | Start menus chained into runs of eighths; the volume hold as a breath |
| 7 | `xp-lan-party` | LAN Party | 126 | 26 phrases, 103 s | 151 | `start-menu`, `window-minimize`, `dialog-error`; `balloon-info`, `dialog-question`, `recycle-bin`; `volume-mute`, `dialog-warning` | Start menus between every other widget; a longer climax |
| 8 | `xp-blue-screen` | Blue Screen Boogie | 130 | 26 phrases, 100 s | 157 | `desktop-refresh`, `dialog-error`, `dialog-info`; `recycle-bin`, `balloon-info`, `start-menu`; `window-minimize`, `dialog-warning`; `progress-download` | Both two-press widgets side by side; mostly full bars of eighths |
| 9 | `xp-spin-cycle` | Spin Cycle | 133 | 28 phrases, 105 s | 155 | `chair-swivel`, `dialog-info`, `dialog-warning`; `start-menu`, `recycle-bin`, `dialog-error`, `balloon-info`; `volume-mute`, `desktop-refresh`, `window-minimize` | Built around the swivel chair (a prototype): a spin from the first phrase, then one between each burst |
| 10 | `xp-system-overload` | System Overload | 136 | 30 phrases, 109 s | 169 | All four boxes; `window-minimize`, `recycle-bin`, `balloon-info`; `volume-mute`, `start-menu`, `desktop-refresh`; `progress-download`; `chair-swivel` | Every XP action, the densest climax |
| 11 | `xp-heaven` | Heaven | 110 | 28 phrases, 127 s | 141 | All four boxes; `balloon-info`, `window-minimize`, `recycle-bin`; `volume-mute`, `start-menu`, `desktop-refresh`; `progress-download`; `chair-swivel` | The closing medley ([ADR 0020](../decisions/0020-heaven-closing-medley.md)): every XP action at a slower tempo, its sections recalling the earlier levels in order: boxes, desktop, shell, then the chair between bursts of everything |
