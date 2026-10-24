// 只给单元测试用：用拍位置列表快速拼出一份谱面。

import type { ActionType } from './actions.ts';
import { buildChart, type Chart } from './chart.ts';
import type { ChartSource } from './chart-file.ts';

export function sourceFromPatterns(
  patterns: readonly (readonly number[])[],
  overrides: Partial<ChartSource> = {},
  action: ActionType = 'close-window',
): ChartSource {
  return {
    format: 1,
    id: 'test',
    title: '测试',
    scene: 'windows-xp',
    bpm: 120,
    beatsPerBar: 4,
    countInBars: 1,
    outroBars: 1,
    // 测试默认不留空档，示范与跟打正好相差 1 小节，拍位置好算
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
