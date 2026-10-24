# 0004 Look close to the original systems

- Status: Accepted
- Date: 2026-10-24

## Context

The earlier rule was "evoke the era, don't copy": Microsoft and Apple assets stayed in `assets/reference/` as reference only, and the game's art and sounds were to be original. After seeing the first interface designs, the user asked for an "almost original" look and stated that the project is for academic use only.

## Options

1. **Original look-alikes**: borrow palettes and structure, draw and record everything ourselves. Far from "almost original".
2. **Close to the originals, using original assets**: windows, taskbar, Start menu, Finder and so on rebuilt at original structure and size, with wallpapers, icons, sounds and fonts taken from `assets/reference/`.

## Decision

Option 2; the asset restriction in AGENTS.md is removed.

## Consequences

- The original assets remain Microsoft's and Apple's. "Academic use" describes the project, not the copyright; the repository is public, so these files are distributed with it. A public release or commercial use needs the assets reassessed and replaced.
- The design system's "don't copy" principle is void; the [main screen designs](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB) (not final) are the visual reference.
