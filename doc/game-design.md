# Game design overview

> Status: Draft

## Concept

A Rhythm Heaven-style rhythm game that turns everyday computing of the early 2000s (pop-ups, closing windows, getting mail, refreshing pages…) into minigames played to the music.

## Decided

- **Plays exactly like Rhythm Heaven**: the game demonstrates a rhythmic action, then the player does the same action in the same rhythm.
- **Theme**: computers and internet culture of the early 2000s.
- **First scenes**:
  1. The Windows XP desktop → [scenes/windows-xp.md](scenes/windows-xp.md)
  2. A Mac desktop from around 2000 → [scenes/mac-2000.md](scenes/mac-2000.md)
- **Example actions**: windows popping up, closing windows, getting mail, clicking refresh.
- **Canvas and scenes**: every scene shares one 1280×720 (16:9) game canvas and only one scene shows at a time, see [ADR 0002](decisions/0002-game-canvas-and-scenes.md).

## Core loop

```
Call ──► Response ──► Feedback ──► Next phrase (gradually harder)
  ▲                                         │
  └─────────────────────────────────────────┘
```

1. **Call**: a demonstrator on screen (the mouse pointer, or another character) performs a set of actions on the beat, with clear sound cues.
2. **Response**: the player performs the same actions on the matching beats.
3. **Feedback**: each action gets instant visual and sound feedback, e.g. a window snaps shut on success, an error dialog pops up on failure.
4. **Song structure**: difficulty rises step by step, with variations midway and usually a climax at the end.

Official levels demonstrate each action right before the phrase that first uses it, and the player must play it back before the chart carries on; the chart goes from easy to hard and lasts at least 1 minute, see [level-design.md](level-design.md).

## Judging (to be refined)

- Initial grades: Perfect / Good / Miss; exact windows to be set after prototype testing.
- The MVP uses Perfect ±45 ms and Good ±100 ms; pressing 100–200 ms before a target counts as a Miss, so mashing can't guess, see [prototypes/mvp.md](prototypes/mvp.md#judging-rules).
- Judging follows the audio playback time.
- Input latency calibration is needed (the Rhythm Heaven series has a similar setting).

## Input (open)

- Options: one or two keys (close to Rhythm Heaven's A button + D-pad), mouse clicks, or both.
- Clicking fits the theme, but the mouse has to be moved into position, which may hurt rhythm judging. Needs a prototype.
- The MVP uses "Space or a click anywhere on the canvas", with no positioning, see [prototypes/mvp.md](prototypes/mvp.md).

## Open questions

- [x] Stack and platforms: web first (TypeScript + PixiJS + Vite+), wrapped with Electron for desktop when needed, see [ADR 0001](decisions/0001-tech-stack.md). Whether mobile is an official target is still open
- [ ] Input: keyboard or mouse? Does the player need to aim?
- [ ] Exact judgement windows
- [ ] Music: the style of the original soundtrack (2000s electronic / pop / collage of system sounds)
- [x] Art style: interfaces close to the originals, using the original system assets directly (academic use only), see [ADR 0004](decisions/0004-authentic-os-look.md)
  - A [design system proposal](https://claude.ai/artifact/YTAfdQKAfiofe7o2vbNz5K) exists and is **not final**: colours, fonts, animation beats and sample copy are all candidates. It shows Mac Platinum (OS 9) and Aqua (early OS X) side by side for choosing a reference.
  - The Mac scene's reference is the early Aqua of Mac OS X 10.0–10.2, see [scenes/mac-2000.md](scenes/mac-2000.md).
  - Near-original designs of the main screens (title, level select, loading, pause, results, settings): [design canvas](https://claude.ai/artifact/UWt5QhiPEBvMN8EsVRvEDB), **not final**.
- [ ] Other 2000s elements beyond the two scenes (MSN / QQ, dial-up, TTPlayer, Flash games, Nokia phones…)
- [ ] Progression: unlocking, ratings, remix levels
  - Provisional: one chart per level; one entry computer per scene in the net café, with levels picked in Explorer / Finder ([level-select.md](level-select.md)); a results window after each round, with each level's best score saved in the browser ([results.md](results.md)). Rating thresholds and scoring are provisional; unlocking isn't built
