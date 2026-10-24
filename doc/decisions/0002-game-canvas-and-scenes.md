# 0002 Game canvas and scene structure

- Status: Accepted
- Date: 2026-10-24

## Context

The game needs one canvas. The XP and Mac desktops are not separate programs but scenes switched on the same canvas, and later themes join as scenes too. To decide: canvas size and aspect, how it fits the window, how scenes switch, and which time scenes draw from.

## Options

1. **Fixed 16:9 at 1280×720**: suits current displays and Steam, no bars in full screen.
2. **Fixed 4:3 at 1024×768**: closer to 2000s monitors, but pillarboxed on wide screens.
3. **Free aspect filling the window**: flexible, but every chart and piece of art must adapt.

## Decision

- **Canvas**: every scene draws in **1280×720** logical coordinates, scaled uniformly to the window, centred, with black bars for the rest. Nothing is drawn outside it.
- **Scenes**: one canvas and one PixiJS `Application`, one scene at a time. Each scene creates and destroys its own view; a scene director registers and switches them, destroying the old scene completely.
- **Time**: every frame a scene gets the audio time being heard (seconds) from the audio clock, never a frame delta, and draws only from that (AGENTS.md, rule 4).
- **Theme**: scene colours are tokens in `src/theme/`, taken from the [design system proposal](https://claude.ai/artifact/YTAfdQKAfiofe7o2vbNz5K); scenes never hard-code colours.
- **Mac scene**: modelled on the early Aqua of Mac OS X 10.0–10.2 ([scenes/mac-2000.md](../scenes/mac-2000.md)).

## Consequences

- `src/game/` holds the canvas, scene interface and director; `src/scenes/<scene>/` the scenes; `src/theme/` the colours.
- `index.html` is the game entry; the prototype list moved into a dev panel on the canvas, which also switches scenes. (The dev panel was later removed, see [ADR 0009](0009-settings-in-system-menus.md).)
