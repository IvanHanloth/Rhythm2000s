# 0021 A playable dance machine with arrows flying to a ring of targets

- Status: Accepted
- Date: 2026-10-25

## Context

The arcade on the street has a dance machine prop marked "OUT OF USE" ([hub.md](../hub.md)). The user asked for its content to be built in 2D: steps are the four arrows ↑ ↓ ← → and combinations of them; after the first build, the combinations became the four diagonals, ← and ↑ together making ↖ and so on. Every other part of the game is call and response on a desktop scene, with charts made of phrases ([chart-format.md](../chart-format.md)).

## Options

Gameplay:

1. **Call and response**: a dancer demonstrates a bar of arrows, the player repeats it; reuses the chart format and level flow.
2. **Classic scrolling arrows**: arrows scroll to fixed targets and the player hits each as it arrives.
3. Both: call and response with scrolling arrows during the response.

Combined steps (two arrows at once):

1. One target: both keys inside the window, graded by the worse press.
2. Each arrow its own target.

Which combinations, and how they are drawn:

1. Any two arrows (←→, ↑↓, ←↑…) as "jumps", two arrows joined by a bar in four lanes.
2. Only the diagonals ↖ ↗ ↙ ↘ (two adjacent keys), with the single arrows too: eight directions.
3. Only the diagonals.

Layout for eight directions: a ring of targets around the centre placed like the pad (arrows fly outward), tilted arrows straddling two of four lanes, or eight lanes in a row.

## Decision

The user chose arrows that travel to fixed targets (2), entered from the arcade's dance machine, two-key steps as one target (1), and the arrow keys plus WASD. After trying the first build (four rising lanes and jumps), the user changed the combinations to eight directions (2) on a pad ring. Details in [dance-machine.md](../dance-machine.md).

## Consequences

- The dance machine is the first mode that isn't call and response. It is not a `SceneEntry` of the scene director, since those are café computers with level lists, editors and showcases; `main.ts` gives it its own `#dance-machine` route and frame loop on the same game canvas and audio clock.
- Dance charts get their own format and folder (`public/dance/`), validated at start-up like desktop charts, with their own test that every file passes.
- A new judge handles four keys and two-key diagonals; it keeps the shared Perfect / Good / early-Miss windows and the cheat's invincible mode. Scoring reuses `summarizeResult`, and best scores go in the current save under the dance chart's id.
- Keyboard input for the arrows is read separately from the Space / click input of the scenes, using the same heard-time conversion.
- The hub gets a third kind of interactive spot besides computers and read-only props.
- The cabinet in the street gets an attract screen and a more detailed placeholder model; a custom model can replace it through the usual `dance-machine` slot with a `SCREEN` mesh.
- No runtime dependency is added.
