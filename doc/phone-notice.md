# Phone notice

> Status: Draft. Phones are not supported for now; this may change if mobile becomes a target ([game-design.md](game-design.md), open questions).

The game is built for a computer: the 3D street, the mouse-driven level select and the keyboard shortcuts all assume a mouse and keyboard. A player who opens it on a phone sees a notice instead of the game.

## Behaviour

- The check runs first, before the game's code is downloaded (`src/game/boot.ts`), so a phone never loads the 3D street or the scenes.
- On a phone the black boot screen stays up and reads:
  - **Rhythm 2000s**
  - Phones aren't supported yet.
  - Please play on a computer.
- There is no way past the notice on a phone.
- On a computer the boot screen shows "Starting up…" and the game loads as before.

## What counts as a phone

The browser's user agent says "Mobi" (every phone browser's does: iPhone Safari and Chrome, Android Chrome and Firefox), and it is not an iPad (Chrome on iPad also says "Mobile"). Tablets are not phones and load the game; so does a phone browser set to "Request desktop site", which then reports a desktop user agent. The rule lives in `src/game/device.ts`.
