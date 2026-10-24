# 0006 Actions named after UI widget classes

- Status: Accepted (supersedes the action naming in [ADR 0003](0003-chart-data-format.md))
- Date: 2026-10-24

## Context

ADR 0003 named action IDs after what the player does, and the MVP had a single `close-window`. When the XP widgets were redesigned (dialogs, tray balloons, Start menu…), the user asked for names "like `dialog-info`, after Windows class names". The old naming had two problems:

- An information, warning or error box all "close a window" but differ in icon and sound, which `close-window` can't express.
- Chart authors think "an error box pops up on this beat", not "the player closes a window here".

## Options

1. **By what the player does** (as was): `close-window`; the scene decides what appears in the call.
2. **By widget class**: `<widget>-<variant>`, e.g. `dialog-info`, `dialog-error`; the chart says what appears and the widget decides how it is handled.

## Decision

Option 2.

- Action IDs are `<widget>-<variant>`, lowercase and hyphenated, from the original system's class or constant names. XP's message box icons `MB_ICONINFORMATION` / `MB_ICONWARNING` / `MB_ICONERROR` / `MB_ICONQUESTION` become `dialog-info` / `dialog-warning` / `dialog-error` / `dialog-question`, matching the icon files in `assets/reference/windows-xp/icons/`.
- An action ID names **the widget that appears in the call**; what the player does with it in the response is in the action table of [chart-format.md](../chart-format.md).
- `close-window` was removed and existing charts switched to `dialog-info`. The format was unpublished, so the version stayed 1.

## Consequences

- New actions are named after their widget, never a verb; Mac actions use Mac class names.
- The four message boxes play the same (pop up → close) with different icons and sounds, and can be mixed in a chart.
