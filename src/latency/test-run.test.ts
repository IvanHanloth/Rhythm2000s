import { describe, expect, it } from 'vite-plus/test';
import { COUNT_IN_CLICKS, LatencyTestRun, MEASURED_BEATS } from './test-run.ts';

// 120 BPM: a click every 0.5 s; the first count-in click at 10 s, measured beat 0 at 12 s
const run = () => new LatencyTestRun(10);

describe('LatencyTestRun', () => {
  it('times count-in clicks first, then the measured beats', () => {
    const test = run();
    expect(test.clickTime(0)).toBe(10);
    expect(test.beatTime(0)).toBe(10 + COUNT_IN_CLICKS * 0.5);
    expect(test.endTime).toBe(test.beatTime(MEASURED_BEATS - 1) + 0.25);
  });

  it('counts the count-in clicks, then follows the measured beats', () => {
    const test = run();
    expect(test.phaseAt(9.9)).toEqual({ kind: 'waiting' });
    expect(test.phaseAt(10)).toEqual({ kind: 'count-in', click: 1 });
    expect(test.phaseAt(11.6)).toEqual({ kind: 'count-in', click: 4 });
    expect(test.phaseAt(11.8)).toEqual({ kind: 'measuring', beat: 0 });
    expect(test.phaseAt(12.6)).toEqual({ kind: 'measuring', beat: 1 });
    expect(test.phaseAt(test.endTime)).toEqual({ kind: 'done' });
  });

  it('matches a press to the nearest beat, once per beat, ignoring the count-in', () => {
    const test = run();
    expect(test.press(11)).toBeNull();
    expect(test.press(12.04)).toBe(0);
    expect(test.offsetsMs[0]).toBeCloseTo(40);
    expect(test.press(12.1)).toBeNull();
    expect(test.press(12.48)).toBe(1);
    expect(test.offsetsMs[1]).toBeCloseTo(-20);
  });

  it('suggests the median offset once enough beats are pressed', () => {
    const test = run();
    for (const [beat, ms] of [
      [0, 30],
      [1, 40],
      [2, 50],
      [3, 35],
    ] as const) {
      test.press(test.beatTime(beat) + ms / 1000);
    }
    expect(test.result().suggestionMs).toBeNull();
    test.press(test.beatTime(4) + 0.045);
    const result = test.result();
    expect(result.presses).toBe(5);
    expect(result.suggestionMs).toBe(40);
    expect(result.meanMs).toBeCloseTo(40);
  });
});
