import { describe, expect, it } from 'vite-plus/test';
import { ACTION_TYPES } from './actions.ts';
import { buildChart } from './chart.ts';
import { sourceFromPatterns } from './test-charts.ts';
import { buildTutorialChart, tutorialActions, tutorialHint, tutorialPassed } from './tutorial.ts';

const chart = buildChart(
  sourceFromPatterns([[0]], {
    bpm: 100,
    phrases: [
      { call: [{ beat: 1, action: 'volume-mute' }] },
      {
        call: [
          { beat: 0, action: 'dialog-info' },
          { beat: 1, action: 'volume-mute' },
        ],
      },
      { call: [{ beat: 0, action: 'progress-download' }] },
    ],
  }),
);

describe('tutorialActions', () => {
  it('按第一次出现的先后列出，不重复', () => {
    expect(tutorialActions(chart)).toEqual(['volume-mute', 'dialog-info', 'progress-download']);
  });
});

describe('buildTutorialChart', () => {
  it('同样的速度、拍号；1 小节预备拍 + 一个乐句，动作在第 1 拍，没有结尾留空', () => {
    const tutorial = buildTutorialChart(chart, 'progress-download');
    expect(tutorial.bpm).toBe(100);
    expect(tutorial.phrases).toEqual([{ callStart: 4, callEnd: 8, responseStart: 8, end: 12 }]);
    expect(tutorial.calls.map((c) => [c.beat, c.action])).toEqual([[4, 'progress-download']]);
    expect(tutorial.responses.map((c) => [c.beat, c.action])).toEqual([[8, 'progress-download']]);
    expect(tutorial.endBeat).toBe(12);
  });
});

describe('tutorialPassed', () => {
  it('每一下都判过、没有 Miss 才算成功', () => {
    expect(tutorialPassed(['perfect', 'good'], 2)).toBe(true);
    expect(tutorialPassed(['perfect', 'miss'], 2)).toBe(false);
    expect(tutorialPassed(['perfect'], 2)).toBe(false);
  });
});

describe('tutorialHint', () => {
  it('每个动作都写了提示（新动作别忘了在 tutorial.ts 里加）', () => {
    const missing = ACTION_TYPES.filter((action) => tutorialHint(action).name === action);
    expect(missing).toEqual([]);
  });

  it('提示文案只用英文', () => {
    for (const action of ACTION_TYPES) {
      const { name, how } = tutorialHint(action);
      expect(`${name}${how}`).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});
