import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from './chart.ts';
import { formatDuration, summarizeChart } from './chart-summary.ts';
import { sourceFromPatterns } from './test-charts.ts';

describe('summarizeChart', () => {
  it('lists the actions used and picks the most common; duration includes count-in and outro', () => {
    const source = sourceFromPatterns([[0, 1, 2], [0]]);
    source.phrases[0]!.call[1]!.action = 'dialog-error';
    source.phrases[1]!.call[0]!.action = 'dialog-error';
    source.phrases[0]!.call[2]!.action = 'dialog-error';
    const summary = summarizeChart(buildChart(source));

    expect(summary.actions).toEqual(['dialog-info', 'dialog-error']);
    expect(summary.mainAction).toBe('dialog-error');
    expect(summary.phrases).toBe(2);
    // 1 count-in bar + 2 phrases of 2 bars + 1 outro bar = 24 beats at 120 BPM
    expect(summary.seconds).toBe(12);
  });

  it('ties go to the action that appears first', () => {
    const source = sourceFromPatterns([[0, 1]]);
    source.phrases[0]!.call[1]!.action = 'dialog-warning';
    expect(summarizeChart(buildChart(source)).mainAction).toBe('dialog-info');
  });
});

describe('formatDuration', () => {
  it('under a minute shows seconds only; longer shows minutes and two-digit seconds', () => {
    expect(formatDuration(38.2)).toBe('0:38');
    expect(formatDuration(65)).toBe('1:05');
  });
});
