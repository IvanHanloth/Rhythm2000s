// Mac 场景对谱面的附加规则（doc/chart-format.md「场景附加规则」）。
// 第几个出现的目标，就由第几下处理；画面上的位置和 Dock 图标有限，每个乐句的个数有上限。

import type { Chart } from '../../rhythm/chart.ts';
import {
  isMacAction,
  MAC_ACTIONS,
  MAX_BOUNCES_PER_PHRASE,
  MAX_WINDOWS_PER_PHRASE,
} from './action-kinds.ts';

export function checkMacChart(chart: Chart): string[] {
  const errors: string[] = [];
  chart.phrases.forEach((_, phrase) => {
    const calls = chart.calls.filter((c) => c.phrase === phrase);
    const responses = chart.responses.filter((c) => c.phrase === phrase);
    if (calls.length !== responses.length) {
      errors.push(
        `phrases[${phrase}]：Mac 场景要求跟打与示范的事件个数相同（示范 ${calls.length} 个，跟打 ${responses.length} 个）`,
      );
    } else {
      responses.forEach((response, i) => {
        const expected = calls[i]!.action;
        if (response.action !== expected) {
          errors.push(
            `phrases[${phrase}].response[${i}]：Mac 场景要求动作与示范的第 ${i + 1} 个事件相同（${expected}）`,
          );
        }
      });
    }

    const kinds = calls.map((c) => (isMacAction(c.action) ? MAC_ACTIONS[c.action].kind : null));
    const windows = kinds.filter((k) => k === 'alert' || k === 'window').length;
    if (windows > MAX_WINDOWS_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]：提示框和文稿窗口合计 ${windows} 个，Mac 场景每个乐句最多 ${MAX_WINDOWS_PER_PHRASE} 个`,
      );
    }
    const bounces = kinds.filter((k) => k === 'dock').length;
    if (bounces > MAX_BOUNCES_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]：dock-bounce 有 ${bounces} 个，Mac 场景每个乐句最多 ${MAX_BOUNCES_PER_PHRASE} 个`,
      );
    }
  });
  return errors;
}
