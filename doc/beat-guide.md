# Beat guide

> Status: Draft. Size, colour and position are a first pass, to tune after play-testing.

A beat cue shown during a round, shaped like `((((O))))`: the centre dot pulses with the beat while arcs close in from both sides and meet the dot exactly on the beat. The player toggles it with **H**; on screen it is called "Beat Guide".

## Look

| Part | Behaviour |
| --- | --- |
| Centre dot | Pulses every beat, largest on the beat and shrinking back within 1/4 beat; flashes yellow on beats to press |
| Arcs | One pair per beat (`(` and `)`), appearing 4 beats ahead at the edges and closing in at a steady speed; on the beat they form a ring around the dot, then fade fast |
| Arc colour | Grey normally, yellow on beats the player presses (response targets). Off-beat presses get their own yellow pair |
| Holds | `volume-mute` and `menu-volume` are held until the game releases them: a translucent yellow bar (28 high) joins the press and end arcs, the end arc is thinner, and the dot stays yellow inside a yellow ring until the end beat |
| Backing | None; drawn straight on the desktop |
| Size | Dot radius 18, ring radius 32, 56 apart per beat (1280×720 logical coordinates); about 520 wide in all |
| Position | Horizontally centred, a little below the middle (centre y = 520); above the desktop, below the judgement labels and turn banner |

- Only presses the player makes count as "to press"; presses the game completes (the second press of the volume actions) are drawn as hold ends.
- Everything is computed from audio time, never frame deltas (AGENTS.md, rule 4).

## Toggle

- Always shown during the system demo ([level-design.md](level-design.md#rule-1-the-system-demonstrates-every-action-first)) to introduce it; after that it follows the player's toggle.
- **H** toggles it in a level, off by default. The state is saved in the browser (off if storage fails, like other [settings](settings.md)).
- The back hint at the bottom left shows the state, e.g. "Esc: back to the café · H: Beat Guide off".

## Recording scores

- A round counts as assisted if the beat guide was on at any point during the chart (not the demo).
- The results window shows a "Beat Guide" tag at the top left of the score box ([results.md](results.md)).
- A new best score set while assisted is saved with a flag, and the intro shows e.g. "Best score 04250 (Beat Guide)"; a higher unassisted score clears the flag.
- Assisted scores can still set the best score (first-version rule; may be kept separately later).

## Candidates / open questions

- How far ahead arcs appear, their spacing and screen position.
- A toggle on the settings page as well.
- Ranking assisted scores separately.
