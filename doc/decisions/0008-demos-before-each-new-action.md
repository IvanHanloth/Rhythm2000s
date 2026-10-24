# 0008 Demos before the phrase that introduces each action

- Status: Accepted
- Date: 2026-10-24

## Context

[ADR 0007](0007-official-level-design-guidelines.md) put every action's demo at the start of the level. In a chart that brings in actions gradually (e.g. `xp-download` adds `balloon-info` only in phrase 8), the player practises an action long before meeting it and has forgotten it by then; a remix opens with a long string of demos before any music plays. The only way to skip was the "Skip tutorial" setting, so a player who already knew the actions had no way out once a level had started.

## Options

1. **All demos up front** (ADR 0007): simple and uninterrupted, but the teaching is far from where it is needed.
2. **Before the phrase that introduces each action**: the chart pauses at that phrase, the new actions are demonstrated, and the chart resumes from that phrase. The teaching sits right before its use, at the cost of breaking the chart into pieces.

Skipping: the setting alone, or the setting plus a key during a demo that skips the rest of the level's demos.

## Decision

- Option 2, as asked by the user: before each phrase that uses actions not seen earlier in the chart, the chart stops and those actions are demonstrated (same rounds and pass rule as ADR 0007), then it resumes from that phrase with a count-in.
- Skipping skips everything: with "Skip tutorial" on no demos run; pressing Tab (later Backspace, since browsers take Tab for moving focus) during a demo ends it and plays the rest of the chart in one go, without any later demo.

Details in [level-design.md](../level-design.md#rule-1-the-system-demonstrates-every-action-before-it-is-used).

## Consequences

- A level with demos plays its chart in pieces; the results and best score gather the judgements of every piece, so they still cover the whole chart.
- Retry on the results, a skipped tutorial and the setting all play the chart in one piece, as before.
- Chart authors should bring in new actions at phrase boundaries they are happy to see paused; the chart format is unchanged.
