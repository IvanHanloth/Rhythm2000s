# Review: Call & Response promo

Render: `renders/rhythm2000s-promo.mp4`, 41.0 s, 1920×1080, 30 fps.

## Creative calls

- Storyline A of `STORYLINES.md` (Call & Response); B (Log On) and C (Error Storm) were not built.
- Every screen is the game itself, recorded from the showcase computers (`footage/README.md`), not rebuilt in HTML.
- The music is the game's own audio from the same takes, cut on bar lines, so the beat never breaks across cuts; the XP Startup sound plays under the end card.
- Copy comes from the game: the booklet ("Watch and listen", "Your turn"), the title screen's tagline, the combo tiers (16, 30) and the README (play URL, HackNotts 26).
- Baloo 2 ExtraBold, the logo face named in `src/theme/tokens.ts`, was added to `assets/fonts/baloo-2/` (OFL). The game itself doesn't load it yet, so its title screen falls back to a system sans.

## Measured, looked at, not checked

- `hyperframes check`: no errors or warnings, 18/18 text checks pass WCAG AA.
- Looked at snapshots of every shot, the whip at 14.0–14.2 s and the end card.
- Loudness measured at -17.1 LUFS integrated, -2.2 dBFS peak. Nobody has listened to it; the joins between bars are 4 ms fades and should be checked by ear.

## Weakest shot / next

- The end card's logo sits over the busy café sign; a slower street take or a calmer framing would help.
- Shots 10–11 (16 in a row) repeat one caption over two shots; a Mac/XP split could replace them.
- Footage is recorded at 120 BPM from one take each; re-recording changes the bar offsets (see `footage/README.md`).
