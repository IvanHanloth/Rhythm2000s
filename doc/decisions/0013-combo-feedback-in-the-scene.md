# 0013 Combo feedback inside the scene, with no effect on the score

- Status: Accepted
- Date: 2026-10-24

## Context

Players had no feedback for a run of good presses beyond each judgement label. The user asked for combo effects. Rhythm Heaven, the model for the game, shows no combo number while playing; its feedback lives in the scene.

## Options

1. **A big combo number** in the middle of the screen, as in many rhythm games: clear, but covers the targets and doesn't match the period look ([ADR 0004](0004-authentic-os-look.md)).
2. **Effects inside the scene** that grow in tiers, with a small period "hit counter" in a corner showing the number.
3. **Effects only**, no number at all, as in Rhythm Heaven.

Scoring: a combo multiplier on the score, or feedback only.

## Decision

The user chose option 2, with feedback only (the score stays as in [results.md](../results.md)) and action demos not counting. Rules in [combo.md](../combo.md).

## Consequences

- The level flow tracks the combo across the chart's pieces, skipping demos, and passes the best combo to the results window.
- Each scene draws its own tier and break effects behind its windows; the hit counter is shared (`src/ui/`).
- Combo can be tuned (thresholds, effects) without touching the score or the judging.
