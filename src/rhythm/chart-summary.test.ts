import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from './chart.ts';
import { formatDuration, summarizeChart } from './chart-summary.ts';
import { sourceFromPatterns } from './test-charts.ts';

describe('summarizeChart', () => {
  it('列出出现过的动作，挑出最多的那个；时长含预备拍和结尾', () => {
    const source = sourceFromPatterns([[0, 1, 2], [0]]);
    source.phrases[0]!.call[1]!.action = 'dialog-error';
    source.phrases[1]!.call[0]!.action = 'dialog-error';
    source.phrases[0]!.call[2]!.action = 'dialog-error';
    const summary = summarizeChart(buildChart(source));

    expect(summary.actions).toEqual(['dialog-info', 'dialog-error']);
    expect(summary.mainAction).toBe('dialog-error');
    expect(summary.phrases).toBe(2);
    // 1 小节预备 + 2 个乐句各 2 小节 + 1 小节结尾 = 24 拍，120 BPM
    expect(summary.seconds).toBe(12);
  });

  it('次数相同时取先出现的动作', () => {
    const source = sourceFromPatterns([[0, 1]]);
    source.phrases[0]!.call[1]!.action = 'dialog-warning';
    expect(summarizeChart(buildChart(source)).mainAction).toBe('dialog-info');
  });
});

describe('formatDuration', () => {
  it('不到 1 分钟只写秒，超过写分和两位秒', () => {
    expect(formatDuration(38.2)).toBe('38 秒');
    expect(formatDuration(65)).toBe('1 分 05 秒');
  });
});
