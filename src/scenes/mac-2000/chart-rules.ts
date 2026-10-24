// Mac 场景对谱面的附加规则（doc/chart-format.md「场景附加规则」）。
// 第几个出现的目标，就由第几下处理；画面上的位置和 Dock 图标有限，每个乐句的个数有上限。

import type { Chart } from '../../rhythm/chart.ts';
import {
  isMacAction,
  MAC_ACTIONS,
  MAX_BOUNCES_PER_PHRASE,
  MAX_CHATS_PER_PHRASE,
  MAX_FILES_PER_PHRASE,
  MAX_WINDOWS_PER_PHRASE,
  usesWindowSlot,
} from './action-kinds.ts';

export function checkMacChart(chart: Chart): string[] {
  const errors: string[] = [];
  chart.phrases.forEach((_, phrase) => {
    const calls = chart.calls.filter((c) => c.phrase === phrase);
    const responses = chart.responses.filter((c) => c.phrase === phrase);
    if (calls.length !== responses.length) {
      errors.push(
        `phrases[${phrase}]: the Mac scene needs as many response events as call events (${calls.length} call, ${responses.length} response)`,
      );
    } else {
      responses.forEach((response, i) => {
        const expected = calls[i]!.action;
        if (response.action !== expected) {
          errors.push(
            `phrases[${phrase}].response[${i}]: the Mac scene needs the same action as call event ${i + 1} (${expected})`,
          );
        }
      });
    }

    const kinds = calls.map((c) => (isMacAction(c.action) ? MAC_ACTIONS[c.action].kind : null));
    const windows = kinds.filter((k) => k !== null && usesWindowSlot(k)).length;
    if (windows > MAX_WINDOWS_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]: ${windows} alerts and windows, the Mac scene allows at most ${MAX_WINDOWS_PER_PHRASE} per phrase`,
      );
    }
    const bounces = kinds.filter((k) => k === 'dock').length;
    if (bounces > MAX_BOUNCES_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]: ${bounces} dock-bounce, the Mac scene allows at most ${MAX_BOUNCES_PER_PHRASE} per phrase`,
      );
    }
    const chats = kinds.filter((k) => k === 'chat').length;
    if (chats > MAX_CHATS_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]: ${chats} ichat-message, the Mac scene allows at most ${MAX_CHATS_PER_PHRASE} per phrase`,
      );
    }
    const files = kinds.filter((k) => k === 'file').length;
    if (files > MAX_FILES_PER_PHRASE) {
      errors.push(
        `phrases[${phrase}]: ${files} dock-trash, the Mac scene allows at most ${MAX_FILES_PER_PHRASE} per phrase`,
      );
    }
  });
  return errors;
}
