// XP 场景对谱面的附加规则（doc/chart-format.md「场景附加规则」）。
// 关掉消息框时要知道「这一下关哪个」：第几个弹出的消息框，就由第几下关掉。

import type { Chart, ChartCue } from '../../rhythm/chart.ts';
import { isDialogKind } from './dialog-kinds.ts';
import { PHRASE_LIMITS } from './shell-actions.ts';

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
      const expected = calls[i]!.action;
      if (response.action !== expected) {
        errors.push(
          `phrases[${phrase}].response[${i}]：XP 场景要求动作与示范的第 ${i + 1} 个事件相同（${expected}）`,
        );
      }
    });
    errors.push(...checkPhraseLimits(phrase, calls));
  });
  return errors;
}

/** 画面上的位置有限，每个乐句里各类目标的个数有上限（doc/scenes/windows-xp-levels.md） */
function checkPhraseLimits(phrase: number, calls: readonly ChartCue[]): string[] {
  const count = (test: (action: string) => boolean) => calls.filter((c) => test(c.action)).length;
  const programs = count((a) => a === 'window-minimize');
  const limits: [string, number, number][] = [
    ['消息框和程序窗口合计', count((a) => isDialogKind(a)) + programs, PHRASE_LIMITS.windows],
    ['window-minimize', programs, PHRASE_LIMITS.programs],
    ['balloon-info', count((a) => a === 'balloon-info'), PHRASE_LIMITS.balloons],
    ['recycle-bin', count((a) => a === 'recycle-bin'), PHRASE_LIMITS.files],
  ];
  return limits
    .filter(([, n, max]) => n > max)
    .map(([name, n, max]) => `phrases[${phrase}]：${name} ${n} 个，XP 场景每个乐句最多 ${max} 个`);
}
