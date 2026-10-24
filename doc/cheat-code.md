# Cheat code: invincible mode

> Status: Draft

A hidden cheat for showing the game off or getting through a hard level: typing the code turns on invincible mode, in which no press can miss. Scores made while it is on are never saved. The cheat hands the player a 10p coin; putting the coin into an arcade machine at FUNLAND AMUSEMENTS turns it off. Decision record: [ADR 0015](decisions/0015-cheat-code-invincible-mode.md).

## Decided

- **The code** is `IvanHanloth` (after one of the makers), typed as letters anywhere in the game: the street, the level list or during a level. Case is ignored.
- **The hint**: the back of the roadworks barrier at the east end of the street, the far end from where the player starts, reads "Cheat Code: IvanHanloth"; the west barrier has none. The back faces away from the street, so it is seen by walking up to the barrier and turning the camera round toward the street.
- **Invincible**: the player presses as usual and every press counts as Perfect; a target the player doesn't press also counts as Perfect. A round can't be failed.
- **Scores aren't recorded** while the cheat is on: no best score is saved and the level doesn't count as played.
- **The coin**: entering the code gives the player a 10p coin. Putting it into **any of the four arcade machines** at FUNLAND AMUSEMENTS ends the cheat; the coin is used up.
- **Refreshing the page** ends the cheat and the coin is gone. Nothing about it is kept in browser storage.

## Provisional (first version, adjustable)

- **Typing**: letters are matched in order; any other character in between (a digit, Space, punctuation) starts the match again. Modifier keys alone (Shift for the capitals) don't break it, and key combinations with Ctrl, Alt or ⌘ are ignored. Typing into a text field (HackerEditor's name fields) doesn't count.
- **Turning it on** plays a two-note coin sound and shows a notice for a few seconds: "Cheat code accepted — you got a 10p coin", with how it works and how to stop it. Typing the code again while it is on only repeats the notice that the coin is already in hand.
- **While it is on**, a small badge with the coin stays at the bottom left of the screen, above the XP taskbar and clear of the hit counter, over the street and the computers alike: "10p · Invincible · Scores not saved".
- **Where it applies**: every round, including the practice demos and HackerEditor's Test. An early press that would be a Miss counts as Perfect; a press that would be Good counts as Perfect. A target nobody presses is hit by the game on its beat, like HackerEditor's Play. A press nearer to a target already hit than to the next one is taken as that target's late press and does nothing, so it can't take the next target early. Presses that match no target still do nothing.
- **Not recorded** means, for a level finished while the cheat was on at any point:
  - no best score is saved and the results window shows no "New record";
  - the level doesn't count as played on the café card;
  - it doesn't count toward the 3 finished charts that unlock the Rickroll ([easter-eggs.md](easter-eggs.md));
  - the results window shows a "Cheat" tag at the top left of the score box, where the Beat Guide tag would be.
- **The arcade**: with the coin in hand, each arcade machine's prompt reads "Insert 10p · Arcade machine" instead of "Examine". Pressing E drops the coin in with a clunk and two lines of dialogue: the coin rattles into the slot, and cheat mode is off so scores count again. Without the coin the machines read their usual notes.

## Code

- `src/game/cheat.ts`: the code reader (letters in, "code complete" out) and the cheat state (on / off), shared by the street and the scenes.
- `src/game/cheat-notice.ts`: the DOM notice and badge, and the coin sounds.
- `src/rhythm/judge.ts`: invincible judging; `src/scenes/shared/round-session.ts` hits unpressed targets on their beat.
- `src/scenes/shared/level-scene.ts`: skips saving scores and the Rickroll count; `src/ui/results-panel.ts` draws the tag.
- `src/hub/hub.ts`, `src/hub/world.ts`: the arcade machines take the coin.
