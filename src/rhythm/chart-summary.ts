// 谱面摘要：选关界面「详细信息」里显示的内容（doc/level-select.md）。不依赖 PixiJS。

import type { ActionType } from './actions.ts';
import type { Chart } from './chart.ts';

export interface ChartSummary {
  /** 谱面里出现过的动作，按第一次出现的顺序 */
  actions: ActionType[];
  /** 出现次数最多的动作；次数相同时取先出现的。用来挑关卡图标 */
  mainAction: ActionType | null;
  phrases: number;
  /** 全曲时长（秒），含预备拍和结尾 */
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

/** 时长写成「38 秒」「1 分 05 秒」 */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} 秒`;
  return `${Math.floor(total / 60)} 分 ${String(total % 60).padStart(2, '0')} 秒`;
}
