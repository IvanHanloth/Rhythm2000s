import { describe, expect, it } from 'vite-plus/test';
import { secondsPerBeat } from './beat.ts';
import {
  chartAtDifficulty,
  chartAtSpeed,
  describeDifficulty,
  DIFFICULTIES,
  DIFFICULTY_SPEEDS,
  FASTEST_SPEED,
  isDifficulty,
  recordedScore,
} from './difficulty.ts';
import { chartFromPatterns } from './test-charts.ts';

describe('difficulty', () => {
  it('lists the five difficulties slowest first, Hell the fastest', () => {
    expect(DIFFICULTIES.map((d) => DIFFICULTY_SPEEDS[d])).toEqual([0.5, 0.8, 1, 1.2, 1.5]);
    expect(FASTEST_SPEED).toBe(1.5);
    expect(describeDifficulty('hard')).toBe('Hard (×1.2)');
    expect(describeDifficulty('normal')).toBe('Normal (×1.0)');
    expect(isDifficulty('hell')).toBe(true);
    expect(isDifficulty('Hell')).toBe(false);
  });

  it('changes only the tempo, so the chart in beats stays the same', () => {
    const chart = chartFromPatterns([[0, 1, 2]]);
    const hell = chartAtDifficulty(chart, 'hell');
    expect(hell.bpm).toBe(chart.bpm * 1.5);
    expect(secondsPerBeat(hell.bpm)).toBeCloseTo(secondsPerBeat(chart.bpm) / 1.5);
    expect({ ...hell, bpm: chart.bpm }).toEqual(chart);
    expect(chartAtDifficulty(chart, 'normal')).toBe(chart);
    expect(chartAtDifficulty(chart, 'heaven').bpm).toBe(chart.bpm / 2);
    expect(() => chartAtSpeed(chart, 0)).toThrow();
  });

  it('records the score times the speed, rounded', () => {
    expect(recordedScore(8500, 'hell')).toBe(12750);
    expect(recordedScore(8500, 'heaven')).toBe(4250);
    expect(recordedScore(10000, 'hell')).toBe(15000);
    expect(recordedScore(8333, 'easy')).toBe(6666);
    expect(recordedScore(8333, 'normal')).toBe(8333);
  });
});
