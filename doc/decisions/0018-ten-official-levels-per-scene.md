# 0018 Ten official levels per scene

- Status: Accepted
- Date: 2026-10-25

## Context

[ADR 0016](0016-five-official-levels-per-scene.md) replaced the development charts with five official levels per scene. The user liked the design and how difficulty was split across the five, and asked for more levels with a finer split.

## Decision

The user asked for five more levels per scene:

- One new level before the first, and one between each pair of the existing five, making ten per scene; each new level's difficulty matches its place.
- The new first level is a little slower than the rest and may have fewer than 100 presses.
- The new level between the old fourth and fifth (now ninth of ten) must use the swivel chair (`chair-swivel`).
- The existing levels may be renamed and their make-up, tempo and rhythms changed to fit the new order.

## Consequences

- [level-design.md](../level-design.md#rule-4-a-full-level-set-official-levels) rule 4 now asks for ten levels per scene, tempo steps of about 3–6 BPM from a first level around 100 BPM, and the chair in the second-to-last level; the 100-press minimum doesn't apply to the first level.
- The existing levels keep their ids, so their best scores still show; their tempos move down to make room for the new levels, and the last level of each scene gets a little denser.
- `chair-swivel` is still a prototype ([cross-dimension.md](../cross-dimension.md)); it now appears in the last two levels of each scene.
