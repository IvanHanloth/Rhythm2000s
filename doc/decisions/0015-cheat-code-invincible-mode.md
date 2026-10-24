# 0015 A cheat code for invincible mode, ended by a coin in the arcade

- Status: Accepted
- Date: 2026-10-24

## Context

The user asked for a cheat code, `IvanHanloth`, that unlocks an invincible mode; scores made with it must not be recorded; entering it gives the player a coin, and putting the coin into a machine in the arcade ends the cheat ([cheat-code.md](../cheat-code.md)). Until now nothing in the game changed judging, and every finished level could set a best score (the beat guide only flags one).

## Options

What "invincible" means:

1. **Every press is Perfect, and unpressed targets count as Perfect**: the player still plays along, but can't miss.
2. **Autoplay**: the game presses every target, as in HackerEditor's Play.
3. **Misses are forgiven**: Perfect and Good are judged as usual, but nothing is a Miss.

How long it lasts:

1. Until the coin is used, even across a refresh (kept in browser storage).
2. Until the coin is used or the page is refreshed (kept in memory only).

## Decision

The user chose invincibility option 1, any of the four arcade machines at FUNLAND AMUSEMENTS for the coin, the code working anywhere in the game, and duration option 2.

## Consequences

- The cheat state lives in one in-memory object created at start-up and handed to both the street hub and the scenes (`SceneContext.cheat`).
- `ResponseJudge.tap` takes an `invincible` flag; `RoundSession` reads the cheat every frame and hits unpressed targets on their beat with the same code path as HackerEditor's Play. Judging is unchanged when the cheat is off.
- A level finished with the cheat on at any point saves no best score, doesn't count as played and doesn't count toward the Rickroll unlock. The results window shows a "Cheat" tag.
- The notice and badge are DOM, like the level intro, since they must show over both the street and the game canvas.
- The arcade machines become the first street props whose interaction depends on game state.
- No runtime dependency is added.
