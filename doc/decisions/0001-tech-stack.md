# 0001 Tech stack

- Status: Accepted
- Date: 2026-10-24

## Context

The game needs a rendering platform and stack. The user leaned towards the browser, falling back to a native client only if the browser couldn't handle the interaction.

Constraints: judging and animation follow the audio clock (AGENTS.md, rule 4); input latency calibration is required; the visuals are 2D retro desktops; only a few keys or mouse clicks are needed. Research: [tech-research.md](../tech-research.md).

## Options

1. **TypeScript + native Web Audio + PixiJS (built with Vite / Vite+)**: full control of the audio clock, small, playable in a browser, wrappable for desktop later. No visual editor; the audio conductor has to be written.
2. **Godot 4**: an editor, and one project exports to web and native. Large web builds; web audio sync unmeasured.
3. **Unity**: mature ecosystem, but limited WebGL audio and heavy for a small 2D game.
4. **Fully native client**: lowest latency, but expensive to build and gives up the web for little gain here.

## Decision

Option 1, **web first**:

- **TypeScript + PixiJS + Vite+**. [Vite+](https://viteplus.dev/guide) (`vite-plus`, MIT) bundles Vite, Vitest, Oxlint, Oxfmt and Rolldown behind the `vp` command and one `vite.config.ts`, which settles testing, linting and formatting too.
- pnpm as package manager, invoked by Vite+ from `packageManager` and the lockfile.
- PixiJS draws the game; the DOM handles menus and settings.
- Web Audio directly, with our own conductor for beat maths, scheduled playback and judging.
- Input uses `event.timeStamp`, converted to the audio timeline with `getOutputTimestamp()`, minus `outputLatency` and the player's calibration.
- Electron (or Tauri) as the wrapper if the game goes to Steam.

Research found no hard blocker in the browser; only distribution could call for a native client, and a wrapper reuses all the code.

## Consequences

- A minimal latency prototype comes first, to check the risks in [tech-research.md, section 5](../tech-research.md#5-risks-to-verify-with-the-latency-prototype). If browser latency or accuracy proves unacceptable, revisit option 2.
- With no ready-made editor, a simple chart / timeline tool may be needed later.
