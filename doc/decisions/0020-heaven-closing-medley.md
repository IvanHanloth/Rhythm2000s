# 0020 A slow medley, Heaven, closes each scene

- Status: Accepted
- Date: 2026-10-25

## Context

Each scene has ten official levels that rise in tempo and widget count ([ADR 0018](0018-ten-official-levels-per-scene.md)). The user asked for one more level per scene after them: a medley called Heaven, where every element appears but the tempo is slower, around 110 BPM.

## Decision

- Each scene gets an eleventh and last level, Heaven (`xp-heaven`, `mac-heaven`), using every action of the scene at 110 BPM.
- Heaven stands outside rule 4's tempo climb ([level-design.md](../level-design.md#rule-4-a-full-level-set-official-levels)); the rules on presses, mixing easy and hard widgets, and rhythm still apply.
- As a medley, its sections recall the earlier levels in order: message boxes, then desktop widgets, then the two-press shell widgets and waits, then the swivel chair with everything.

## Consequences

- The level title matches the slowest difficulty's name, Heaven (×0.5, [difficulty.md](../difficulty.md)), so the intro can read "Heaven" twice when played on that difficulty.
- `chair-swivel`, still a prototype ([cross-dimension.md](../cross-dimension.md)), now appears in the last three levels of each scene.
