// XP 场景对谱面的附加规则（doc/chart-format.md「场景附加规则」）。
// 关窗时要知道「这一下关哪个窗口」：第几个弹出的窗口，就由第几下关掉。

import type { Chart } from '../../rhythm/chart.ts';

export function checkWindowsXpChart(chart: Chart): string[] {
  const errors: string[] = [];
  chart.phrases.forEach((_, phrase) => {
    const calls = chart.calls.filter((c) => c.phrase === phrase);
    const responses = chart.responses.filter((c) => c.phrase === phrase);
    if (calls.length !== responses.length) {
      errors.push(
        `phrases[${phrase}]：XP 场景要求跟打与示范的事件个数相同（示范 ${calls.length} 个，跟打 ${responses.length} 个）`,
      );
      return;
    }
    responses.forEach((response, i) => {
      // 写成 string：目前只有一种动作时，TypeScript 会把不相等的分支推断成不可能
      const expected: string = calls[i]!.action;
      if (response.action !== expected) {
        errors.push(
          `phrases[${phrase}].response[${i}]：XP 场景要求动作与示范的第 ${i + 1} 个事件相同（${expected}）`,
        );
      }
    });
  });
  return errors;
}
