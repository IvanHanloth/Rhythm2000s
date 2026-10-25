# AGENTS.md

For AI coding assistants (Claude Code, Codex, Cursor and others) and new collaborators. Read this file, then `memory/MEMORY.md`, before starting any work.

## About the project

**Rhythm 2000s** is a rhythm game (the name is always written "Rhythm 2000s"; the repository, npm package and save keys in code stay `rhythm2000s`) that plays exactly like Rhythm Heaven, themed on computers and the internet of the early 2000s.

- **Core loop (call & response)**: the game demonstrates a rhythmic action, then the player repeats it in the same rhythm.
- **Scenes so far**:
  - The Windows XP desktop
  - A Mac desktop from around 2000 (Mac OS 9 / early Mac OS X Aqua)
- **Example actions**: windows popping up and closing on the beat, getting mail, clicking refresh.

Design details: [doc/game-design.md](doc/game-design.md).

## Current stage

**Building the game itself.** The stack is in [ADR 0001](doc/decisions/0001-tech-stack.md); the game canvas and scene structure are in place ([ADR 0002](doc/decisions/0002-game-canvas-and-scenes.md)). The Windows XP scene has a playable [MVP "pop up → close"](doc/prototypes/mvp.md) whose input, judgement windows and charts are provisional until play-tested. The Mac scene recreates the early Aqua of Mac OS X 10.0–10.2 with its own actions and charts and the same gameplay as XP ([doc/scenes/mac-2000.md](doc/scenes/mac-2000.md)). On the computer, levels are picked with the mouse in XP Explorer / Mac Finder ([doc/level-select.md](doc/level-select.md)), a results window follows each round ([doc/results.md](doc/results.md)), progress is kept in one of three save slots picked on the title screen with Continue / Load Game / New Game ([doc/save-slots.md](doc/save-slots.md), [ADR 0017](doc/decisions/0017-save-slots.md)), the settings window opens from XP's Start menu / the Mac's Apple menu ([doc/settings.md](doc/settings.md)), and charts can be imported into the browser and exported from the level list ([doc/chart-import-export.md](doc/chart-import-export.md)). Behind each play computer in the café is a HackerEditor computer for making charts, with play and test inside the editor ([doc/chart-editor.md](doc/chart-editor.md), [ADR 0012](doc/decisions/0012-in-game-chart-editor.md)). Behind those, the back row has a showcase computer per system that plays every widget, hit effect, rhythm widget and combo effect one at a time; nothing in the game may say what it does ([doc/showcase.md](doc/showcase.md)). An easter egg replays the 2007 GTA IV trailer Rickroll through each computer's mail program and browser once three charts are finished ([doc/easter-eggs.md](doc/easter-eggs.md), [ADR 0014](doc/decisions/0014-rickroll-embeds-youtube.md)). Typing the cheat code `IvanHanloth` anywhere turns on an invincible mode whose scores aren't saved, ended by putting its 10p coin in an arcade machine ([doc/cheat-code.md](doc/cheat-code.md), [ADR 0015](doc/decisions/0015-cheat-code-invincible-mode.md)). Charts are JSON files in `public/charts/`, separate from the code ([ADR 0003](doc/decisions/0003-chart-data-format.md), format in [doc/chart-format.md](doc/chart-format.md)). The title screen and level select are a realistic 3D street ([ADR 0005](doc/decisions/0005-3d-street-hub-with-threejs.md), design in [doc/hub.md](doc/hub.md)); sitting at a computer in the net café enters a level. Period prop models are made by the user in Tripo / Blender to the spec in [doc/hub-assets.md](doc/hub-assets.md).

- Use only the agreed stack. Before adding a runtime dependency (especially audio, rendering or state management), explain the reason and trade-offs to the user.
- The [latency test](doc/latency-test.md) runs inside each computer's settings window; next it needs measuring on different devices, browsers and headphones, with results logged in its "Test log".

## Layout

```
.
├── AGENTS.md          # This file
├── README.md
├── index.html         # Game entry: game canvas (the only page)
├── public/charts/     # Chart JSON: index.json plus one file per chart, fetched at runtime
├── public/models/     # 3D models for the hub (GLB): props/ stock, custom/ bespoke (spec in doc/hub-assets.md)
├── public/textures/   # Hub PBR textures and monitor images; sources and licences in assets/README.md
├── assets/            # Shared assets: original system references, fonts; sources and licences in assets/README.md
├── promo/             # Promo video (HyperFrames: HTML + GSAP rendered to MP4), separate from the game; see promo/AGENTS.md
├── src/
│   ├── game/          # Game canvas (1280×720, scaled to fit), scene interface, scene director, input, settings, entry
│   ├── hub/           # 3D street hub: title screen and level select (Three.js, ADR 0005)
│   ├── scenes/        # One folder per scene; catalog.ts registers each scene's actions
│   │   ├── shared/    # What every desktop scene shares: level flow, round session, drum track, pointer path, chart rules
│   │   ├── windows-xp/ # components/ holds widgets faithful to the original
│   │   └── mac-2000/
│   ├── theme/         # Scene theme colours, fonts, judgement colours, animation beats; xp-luna.ts and aqua.ts are the original palettes
│   ├── ui/            # Canvas widgets shared across scenes (judgement labels, banners, results, settings and latency test panels, easing)
│   ├── audio/         # Audio clock, metronome, sequencer, synthesised drums and effects
│   ├── rhythm/        # Beat ↔ audio time, action IDs, chart validation and expansion, judging, turn cues
│   ├── editor/        # HackerEditor's chart drafts, edits, undo and problems (no PixiJS; the window is in src/ui and the scenes)
│   └── latency/       # Latency test run and offset statistics
├── vite.config.ts     # All Vite+ configuration: build, test, format, lint, import aliases
├── tsconfig.json
├── package.json
├── pnpm-workspace.yaml # pnpm settings (Vite+ version catalog and nodeLinker; see the comments)
├── doc/               # Design and technical docs (for people and AI)
│   ├── README.md      # Doc index and writing conventions
│   ├── game-design.md # Game design overview
│   ├── tech-research.md # Browser capabilities, options compared, risks to verify
│   ├── scenes/        # Scene designs
│   ├── prototypes/    # Prototype notes
│   └── decisions/     # Architecture decision records (ADRs)
└── memory/            # Shared LLM memory: context, preferences and conventions across sessions
    ├── README.md      # Memory format and rules
    └── MEMORY.md      # Memory index
```

- Imports across folders use the aliases `@/` (src), `@assets/` and `@public/`, declared in `vite.config.ts` and mirrored in `tsconfig.json`; imports within a folder use `./`.
- Unit tests sit next to the code as `*.test.ts` and import the test API from `vite-plus/test`. Test-only helpers are `test-*.ts` (e.g. `src/rhythm/test-charts.ts`, `src/scenes/shared/test-audio.ts`).
- A new stand-alone page would need registering in `build.rolldownOptions.input` in `vite.config.ts`; today `index.html` is the only one.
- A new desktop scene goes in `src/scenes/<scene>/`: extend `LevelScene` (`src/scenes/shared/level-scene.ts`) for the level flow, build its round on `RoundSession`, register its name and actions in `src/scenes/catalog.ts` and add it in `src/game/main.ts`. Scenes draw in 1280×720 logical coordinates with colours from `src/theme/` only.
- A new chart: read the [level design guidelines](doc/level-design.md) first (the opening demo is generated by the system, not written in the chart; easy to hard; at least 1 minute of chart), add `<chart id>.json` to `public/charts/` and list it in `index.json`; `vp test` validates every chart there. A new action type: update the action table in [doc/chart-format.md](doc/chart-format.md) first, then `src/rhythm/actions.ts` and the scene catalog.
- `promo/` is not part of the game build: it is previewed and rendered with `npx hyperframes` (pinned in `promo/package.json`) and stays out of the game's pnpm dependencies. `promo/assets` is a symlink to the root `assets/`, so videos reference `assets/...` (the HyperFrames preview server can't read outside the project; on Windows clone with `git config core.symlinks true`). Use the `/hyperframes` skill before making videos.

## Stack

Web first, with the browser as the main platform; wrap with Electron if it ships on Steam. See [ADR 0001](doc/decisions/0001-tech-stack.md).

| Part | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript | |
| Toolchain | [Vite+](https://viteplus.dev/guide) (npm package `vite-plus`) | One tool for the dev server (Vite), build (Rolldown), tests (Vitest), lint (Oxlint) and format (Oxfmt); all configuration in the root `vite.config.ts`, importing `defineConfig` from `vite-plus`. Don't add ESLint, Prettier, Jest or similar |
| Rendering | PixiJS (npm package `pixi.js`) | Game visuals; menus and settings may use the DOM |
| 3D hub | Three.js (npm package `three`) | Only for the 3D street of the title screen and level select (`src/hub/`), see [ADR 0005](doc/decisions/0005-3d-street-hub-with-threejs.md); GLB models in `public/models/` |
| Audio | Native Web Audio API | Our own "conductor" for beat maths, scheduled playback and judging; no Howler.js-style playback wrappers |
| Package manager | pnpm 12 | Version in `devEngines.packageManager` in `package.json`; Vite+ calls it from that and the lockfile. Uses `nodeLinker: hoisted`, see the comment in `pnpm-workspace.yaml` |
| Runtime | Node.js 24 | |

Audio and input timing rules (details in [doc/tech-research.md](doc/tech-research.md), section 2):

- Every sound is scheduled on the audio clock with `AudioBufferSourceNode.start(when)`.
- Judging uses the input event's `event.timeStamp`, converted to the audio timeline through `AudioContext.getOutputTimestamp()`, minus `outputLatency` and the player's calibration.
- Each frame is drawn from the current audio time, never by accumulating frame deltas.

## Commands

```bash
vp install     # Install dependencies (runs pnpm)
vp dev         # Dev server, http://localhost:5173/ by default
vp check       # Format, lint and type check together; --fix to fix
vp test        # Unit tests (Vitest)
vp run build   # Type check (tsc) + build to dist/
vp preview     # Preview the build locally
vp add <pkg>   # Add a dependency
```

- Game: with the dev server running, open `http://localhost:5173/` for the 3D street (title screen and level select). Append `#scene` (e.g. `#mac-2000`) to open a scene, `#scene/chart` (e.g. `#windows-xp/xp-dial-up`) to open one level, or `#editor/scene` (e.g. `#editor/mac-2000`) to open HackerEditor; Esc in a level returns to the street. There is no dev panel ([ADR 0009](doc/decisions/0009-settings-in-system-menus.md)); player settings open from the in-game Start menu / Apple menu ([doc/settings.md](doc/settings.md)).
- Built-in commands like `dev`, `build` and `test` don't read `package.json` scripts. `vp build` only builds; use `vp run build` to include `tsc`.
- Without a global `vp` (installation in the [Vite+ docs](https://viteplus.dev/guide)), prefix commands with `pnpm exec`, e.g. `pnpm exec vp dev`.
- Run `vp check` and `vp test` before every commit. GitHub Actions (`.github/workflows/ci.yml`) runs check, test and build again on push.
- Deploy: once those pass on `main`, the same workflow publishes `dist/` to GitHub Pages (<https://ivanhanloth.github.io/Rhythm2000s/>). The build is served from the repository sub-path (Vite's `--base`), so files in `public/` must be fetched through `import.meta.env.BASE_URL`, never a bare `/charts/...`-style path. To try the sub-path build locally: `vp build --base /Rhythm2000s/`, then `vp preview --base /Rhythm2000s/`.

## Terms

| Term | Meaning |
| --- | --- |
| Call | The part where the game demonstrates the actions and rhythm; the player only watches and listens |
| Response | The part where the player repeats the demonstrated actions and rhythm |
| Beat | The time unit derived from the BPM; chart times are always in beats, never milliseconds |
| Action | An event in a chart: the widget that appears in the call and that the player handles in the response. Action IDs follow the original class names, e.g. `dialog-info` ([ADR 0006](doc/decisions/0006-actions-named-after-ui-classes.md)) |
| Judgement window | How far an input may be from its target beat, graded Perfect / Good / Miss |
| Chart | The timeline of every call and response event in a song |
| Scene | A themed minigame such as "the Windows XP desktop" |

## Working rules

1. **Language**: everything in the repository is English — player-visible text, code identifiers, comments, error messages, test names, docs, memory and commit messages. XP / Mac interface text follows the original English versions.
2. **Docs first**: before adding or changing gameplay, scenes or judging rules, update the relevant docs in `doc/`, then the code.
3. **Record decisions**: important choices (technology, architecture, key gameplay rules) get a new ADR in `doc/decisions/`.
4. **Rhythm timing**: judging and animation follow the audio clock, never frame counts or timers like `setTimeout`.
5. **Small commits**: one thing per commit, with a message saying what changed and why. No AI attribution (`Co-Authored-By`, "Generated with ...") in commit messages or PR descriptions.
6. **Don't invent**: when requirements are unclear, ask the user instead of filling in design details and writing them up as settled.
7. **No silent fallbacks**: don't paper over missing data with defaults (`?? 0`, `?? {}`) or loose types (`unknown`, `as` casts) outside real boundaries such as parsing JSON; let the type system or an explicit error catch the mistake.

## Assets

The project is for academic use only, and the interface aims to look like the original Windows XP and Mac OS, see [ADR 0004](doc/decisions/0004-authentic-os-look.md).

- Original system assets live in `assets/reference/` and may be used by the game and the promo video.
- Register the source of every new asset in `assets/README.md`.

## LLM memory (memory/)

`memory/` keeps project context to share across sessions and assistants: user preferences, agreed conventions and context the code and docs don't show.

- At the start: read the `memory/MEMORY.md` index, then the entries you need.
- When you learn something worth keeping (a correction, a confirmed preference, a project constraint): add or update an entry in the format of `memory/README.md` and update the index.
- Don't repeat in memory what the code, `doc/` or git history already says.
- Fix or delete memories that are stale or wrong.
