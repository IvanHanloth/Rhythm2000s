// Unit tests only: builds a chart quickly from lists of beat positions.

import type { ActionType } from './actions.ts';
import { buildChart, type Chart } from './chart.ts';
import type { ChartSource } from './chart-file.ts';

export function sourceFromPatterns(
  patterns: readonly (readonly number[])[],
  overrides: Partial<ChartSource> = {},
  action: ActionType = 'dialog-info',
): ChartSource {
  return {
    format: 1,
    id: 'test',
    title: 'Test',
    scene: 'windows-xp',
    bpm: 120,
    beatsPerBar: 4,
    countInBars: 1,
    outroBars: 1,
    // Tests default to no gap, so call and response are exactly one bar apart
    responseGapBeats: 0,
    phrases: patterns.map((pattern) => ({ call: pattern.map((beat) => ({ beat, action })) })),
    ...overrides,
  };
}

export function chartFromPatterns(
  patterns: readonly (readonly number[])[],
  overrides: Partial<ChartSource> = {},
): Chart {
  return buildChart(sourceFromPatterns(patterns, overrides));
}
