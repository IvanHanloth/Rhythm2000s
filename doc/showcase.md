# Showcase computers

> Status: Draft. What is shown, its order and that the row is secret are the user's (2026-10-25); the timing under "Provisional" is not settled.

The café's back row has one showcase computer per scene. Sitting at one plays an animated tour of that system: every widget, then the hit effects, the rhythm widgets and the combo effects, one at a time, while the computer plays along by itself. It is for showing the game to an audience.

## Decided

- **Where**: the back row of the café ([hub.md](hub.md)), first seat Windows XP, second seat Mac, the same columns as the play computers and editors in front of them.
- **Secret**: nothing in the game says what these computers do. No marker floats over them, the guide booklet and the objectives leave them out, and the prompt and the card only say "Computer" (the card's button reads "Open", with no details and no best score). Walking up and sitting down works like any other entry computer.
- **Order**: the widgets (every action of the scene), then the hit effects, then the rhythm widgets, then the combo effects.
- **One thing at a time**: each item shows on its own on the empty desktop, never two at once. The only exception is the hit counter, which shows with the combo effects.
- **Combo effects alone**: each tier's effect shows without the tiers below it (unlike a round, where they add up, [combo.md](combo.md#tiers)), and the hit counter in the top right stands at that tier's count: 8, 16, 30.

## Flow

```
Seated at a showcase computer ── E ──► the desktop, empty ──► count-in bar ──► widgets ──► hit effects ──► rhythm widgets ──► combo ─┐
            ▲                                                       ▲                                                              │
            └──────────────────────── Esc ──────────────────────────┴───────────────────── loops ──────────────────────────────────┘
```

The showcase computers open `#showcase/<scene>` (e.g. `#showcase/windows-xp`). There is no level list, no Start / Apple menu and no mail; clicks and Space do nothing; Esc goes back to the café.

## The tour

| Part | Item | What shows |
| --- | --- | --- |
| Widgets | Each action of the scene, in the scene catalog's order (`src/scenes/catalog.ts`) | One phrase, like a demo: the computer does the call, then the response on the same beats with the virtual mouse. No banner, beat guide, judgement label, counter or combo effect |
| Hit effects | Perfect!, Good, Miss | The judgement label alone in the middle of the screen: it pops with the squash on the bar's first beat, holds and fades as in a round |
| Rhythm widgets | Beat guide | The `((((O))))` beat guide alone for a one-action phrase, so its press beat lights yellow ([beat-guide.md](beat-guide.md)) |
| | Turn banner | "Follow me" over the call bar, then "Your turn" over the response bar |
| Combo | Tier 1, 2, 3 | Each tier's effect alone, the counter rolling up to 8, 16 and 30 on the part's first beat ("HOT!" from 16 on) |
| | Combo break | The counter goes from 30 back to 0 with its red flash, and the scene's break effect: XP's unplug chime, the Mac's spinning wait cursor |

- The widgets play with their own sounds and backing drums, like a round; the other parts have the shared drum pattern (kick and snare on the beats, a hi-hat every half beat). The first bar of every pass is a count-in with the metronome.
- Everything follows the audio clock, like a round (AGENTS.md, rule 4). Nothing is judged or recorded: no score, best combo, finished chart or objective.
- chair-swivel's cutaway shows the café at the showcase computer itself.

## Provisional

- **Tempo**: 120 BPM in 4/4 throughout.
- **Lengths**: a widget is one phrase (2 bars); each hit effect 1 bar; the beat guide 3 bars (a count-in bar so its arcs can close in, then the phrase); the turn banner 2 bars; tiers 1 and 2 two bars each, tier 3 four bars (the Solitaire cascade needs time to build), the break 1 bar.
- **After the last item**: the tour starts again with its count-in bar, until Esc.

## Candidates / open questions

> Ideas only, not decided.

- The hit sounds with the hit effects.
- Showing the demo caption or the results window.
