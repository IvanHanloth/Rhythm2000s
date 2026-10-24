---
name: project-concept
description: The project's core concept and early timeline (started 2026-10-24; stack, scaffold and latency prototype the same day)
metadata:
  type: project
---

Rhythm 2000s (the game's name is capitalised; the repository, package name and save keys stay `rhythm2000s`) is a rhythm game that plays exactly like Rhythm Heaven — the game demonstrates a rhythmic action and the player repeats it in the same rhythm — themed on computers of the early 2000s. The first scenes are the Windows XP desktop and a Mac desktop from around 2000, with actions like opening and closing windows, getting mail and clicking refresh.

On 2026-10-24 the repository was set up (AGENTS.md, doc/, memory/) and the user confirmed the stack as TypeScript + PixiJS + Vite+ (ADR 0001; first Vite, switched to Vite+ straight away so testing, linting and formatting all come from Vite+). PocketJS was considered and dropped for lacking input timestamps and an audio clock. The same day the scaffold and latency test prototype were built (not yet measured on real devices), then work on the game began with the game canvas and XP / Mac placeholder scenes (ADR 0002). Input, judgement windows, art and music direction were still open at that point.

**Why:** the project is early in design and many reasonable-looking details are not decided.
**How to apply:** never treat a proposal as settled; ask the user before choosing technology or filling in design, and record the outcome in doc/decisions/.
