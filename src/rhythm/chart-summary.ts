// Chart summary: what the level select's "Details" panel shows (doc/level-select.md). No PixiJS.

import type { ActionType } from './actions.ts';
import type { Chart } from './chart.ts';

export interface ChartSummary {
  /** Actions used in the chart, in order of first appearance */
  actions: ActionType[];
  /** The most common action; ties go to the first. Used to pick the level icon */
  mainAction: ActionType | null;
  phrases: number;
  /** Length of the whole song in seconds, including count-in and outro */
  seconds: number;
}

export function summarizeChart(chart: Chart): ChartSummary {
  const counts = new Map<ActionType, number>();
  for (const call of chart.calls) counts.set(call.action, (counts.get(call.action) ?? 0) + 1);
  let mainAction: ActionType | null = null;
  for (const [action, count] of counts) {
    if (mainAction === null || count > counts.get(mainAction)!) mainAction = action;
  }
  return {
    actions: [...counts.keys()],
    mainAction,
    phrases: chart.phrases.length,
    seconds: (chart.endBeat * 60) / chart.bpm,
  };
}

/** Duration as m:ss, e.g. "0:38", "1:05" */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `0:${String(total).padStart(2, '0')}`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
