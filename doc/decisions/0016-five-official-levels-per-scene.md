# 0016 Five official levels per scene, replacing the development charts

- Status: Accepted; extended to ten levels per scene by [ADR 0018](0018-ten-official-levels-per-scene.md)
- Date: 2026-10-25

## Context

During development each new action got its own short test chart (`xp-tray`, `mac-dock-hop` and so on), plus a remix and a swivel-chair test level per scene: 12 XP and 11 Mac charts, most under a minute and each built around one or two actions. [ADR 0007](0007-official-level-design-guidelines.md) deferred bringing them up to the official level rules to the polish phase. The user judged them too low in quality to ship and asked for every one of them to be replaced.

## Decision

The user set what an official level set is ([level-design.md](../level-design.md#rule-4-a-full-level-set-official-levels)):

- Five levels per scene, replacing every existing chart.
- Each level lasts at least 1 minute and has at least 100 presses, with many widgets, from easy to hard, following the drum beat with patterns that combine.
- From the first level to the last, the levels use more widgets, and each level mixes easy and hard widgets rather than using only one kind.
- Later levels are faster, in moderate steps.

## Consequences

- The old charts are deleted from `assets/public/charts/`; best scores saved under their ids are simply no longer shown.
- The unit tests that relied on the MVP chart (`xp-popup-mvp`) load a copy kept next to them as a test fixture, so shipped levels can change freely.
- `chair-swivel` is still a prototype ([cross-dimension.md](../cross-dimension.md)); it appears only in each scene's last level and can be taken out of those two charts if the prototype is dropped.
- Each level's charted rhythms are a first draft for the user to play-test.
