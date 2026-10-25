# Documentation index

| Document | Contents | Status |
| --- | --- | --- |
| [game-design.md](game-design.md) | Game design overview: core loop, judging, scenes, open questions | Draft |
| [scenes/windows-xp.md](scenes/windows-xp.md) | Scene: the Windows XP desktop; widgets (desktop, Start menu, message boxes, tray, volume control) and their sounds | Draft |
| [scenes/windows-xp-levels.md](scenes/windows-xp-levels.md) | The later XP actions (tray balloon, minimise, Start menu, Recycle Bin, download, volume) and every XP level | Draft |
| [scenes/mac-2000.md](scenes/mac-2000.md) | Scene: a Mac desktop from around 2000 | Draft |
| [hub.md](hub.md) | Title screen and street hub: flow, controls, the provisional street and shops | Draft |
| [save-slots.md](save-slots.md) | Save slots: three named saves picked on the title screen (Continue / Load Game / New Game), what is per save and what is shared | Draft |
| [results.md](results.md) | Results: the score window after a round, provisional scoring, ratings and comments | Draft |
| [level-select.md](level-select.md) | Level select: the level list on the in-game computer (XP Explorer, Mac Finder), mouse control and going back | Draft |
| [hub-assets.md](hub-assets.md) | Custom models for the street: spec (size, facing, origin, SCREEN mesh) and slot list | Draft |
| [level-design.md](level-design.md) | Official level design guidelines: the system demonstrates every action first, easy to hard, at least 1 minute of chart | Draft |
| [beat-guide.md](beat-guide.md) | Beat guide: the `((((O))))` beat cue, toggled with H and flagged on scores | Draft |
| [combo.md](combo.md) | Combo: counting, the hit counter, XP / Mac tier and break effects, best combo and Full Combo on the results | Draft |
| [settings.md](settings.md) | Settings window in the XP / Mac system menus: latency calibration, skip tutorial, Beat Guide, keyboard shortcuts | Draft |
| [easter-eggs.md](easter-eggs.md) | Easter eggs: the GTA IV trailer mirror Rickroll unlocked by finishing 3 charts (mail, 4chan thread, YouTube) | Draft |
| [cheat-code.md](cheat-code.md) | Cheat code `IvanHanloth`: invincible mode, scores not saved, ended by putting the 10p coin in an arcade machine | Draft |
| [dance-machine.md](dance-machine.md) | Dance machine in the arcade: eight directions (diagonals from two keys) flying to a pad ring, arrow keys / WASD, its own chart format, the cabinet's attract screen | Draft (prototype) |
| [cross-dimension.md](cross-dimension.md) | Cross-dimension action prototype: a press cuts to the 3D café, the character spins on the swivel chair, back to the level | Draft (prototype) |
| [chart-format.md](chart-format.md) | Chart JSON format: location, fields, action IDs, validation | Draft |
| [chart-editor.md](chart-editor.md) | Chart editor on its own café computers: period program window, phrase-by-phrase timeline, play and test | Draft |
| [showcase.md](showcase.md) | Showcase computers in the café's back row: an animated tour of every widget, hit effect, rhythm widget and combo effect, one at a time | Draft |
| [chart-import-export.md](chart-import-export.md) | Importing charts into the browser and exporting any chart, from the level list | Draft |
| [phone-notice.md](phone-notice.md) | Phone notice: phones see "not supported yet, please play on a computer" instead of the game | Draft |
| [tech-research.md](tech-research.md) | Technical research: browser capabilities, stack comparison, risks to verify | Draft |
| [latency-test.md](latency-test.md) | Latency test: the in-game XP / Mac test windows, time conversion, suggested calibration, test log | Draft |
| [prototypes/mvp.md](prototypes/mvp.md) | MVP: XP "pop up → close", provisional input, judgement windows, chart and sounds | Draft |
| [decisions/](decisions/README.md) | Architecture decision records (ADRs) | — |
| [Design system (external)](https://claude.ai/artifact/YTAfdQKAfiofe7o2vbNz5K) | Visual proposal: XP / Mac Platinum / Mac Aqua scene themes; colour, type, spacing, motion (in beats); window, button, dialog and judgement components | Proposal |

## Conventions

- Write in English Markdown and state the **status** at the top of each document: `Draft` / `In review` / `Final`.
- Keep what is decided apart from ideas and proposals. Proposals go in a "Candidates / open questions" section, never written as settled.
- Chart and rhythm timing is always in beats (e.g. "the off-beat of beat 3"), never milliseconds.
- Register every new document in this index.
