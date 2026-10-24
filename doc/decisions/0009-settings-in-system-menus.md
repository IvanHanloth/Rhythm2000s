# 0009 Settings in the in-game system menus, no dev panel

- Status: Accepted
- Date: 2026-10-24

## Context

The input calibration and "Skip tutorial" lived in a dev panel across the top of the page, which also switched scenes and linked the XP and Mac widget gallery prototypes ([ADR 0002](0002-game-canvas-and-scenes.md)). It looked like a debug tool, broke the period look ([ADR 0004](0004-authentic-os-look.md)) and was the only home for settings players need. [ADR 0007](0007-official-level-design-guidelines.md) already called for a settings page.

## Options

1. **A DOM settings screen on the title screen in the street**: one place for both scenes, but away from where levels are played and outside the period look.
2. **A settings window on each in-game computer, opened from that system's menu** (XP "start" → "Control Panel", Mac Apple menu → "System Preferences…"): fits the look and sits next to the level list; two native-styled windows to build.

## Decision

- Option 2, as asked by the user. Both windows share one panel (`src/ui/settings-panel.ts`) with native widgets supplied by each scene, as the results window does. Contents and rules in [settings.md](../settings.md).
- The dev panel and the two widget gallery prototypes are removed. Scenes and levels still open from the URL hash. The latency test prototype stays, linked from the title screen (later replaced by in-game tests, [ADR 0010](0010-latency-test-in-game.md)).

## Consequences

- Scenes get the player settings through `SceneContext.settings` and can change them; the shell and the open settings window both follow changes (H in a level updates the check box).
- Widgets are checked against the originals in the game itself rather than in a gallery.
- There is no in-page way to jump between scenes during development; use the URL.
