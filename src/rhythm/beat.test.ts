import { describe, expect, it } from 'vite-plus/test';
import { beatToTime, nearestBeat, secondsPerBeat, timeToBeat } from './beat.ts';

describe('secondsPerBeat', () => {
  it('120 BPM is 0.5 s per beat', () => {
    expect(secondsPerBeat(120)).toBe(0.5);
  });

  it('rejects non-positive BPM', () => {
    expect(() => secondsPerBeat(0)).toThrow(RangeError);
    expect(() => secondsPerBeat(-60)).toThrow(RangeError);
    expect(() => secondsPerBeat(Number.NaN)).toThrow(RangeError);
  });
});

describe('beatToTime / timeToBeat', () => {
  it('are inverses of each other', () => {
    const start = 1.25;
    for (const beat of [0, 1, 3.5, 17]) {
      expect(timeToBeat(start, 90, beatToTime(start, 90, beat))).toBeCloseTo(beat, 10);
    }
  });

  it('times before the start give negative beats', () => {
    expect(timeToBeat(2, 120, 1.5)).toBe(-1);
  });
});

describe('nearestBeat', () => {
  it('a bit late is a positive offset', () => {
    const result = nearestBeat(1, 120, 2.03);
    expect(result.beat).toBe(2);
    expect(result.offset).toBeCloseTo(0.03, 10);
  });

  it('a bit early is a negative offset', () => {
    const result = nearestBeat(1, 120, 1.97);
    expect(result.beat).toBe(2);
    expect(result.offset).toBeCloseTo(-0.03, 10);
  });

  it('input before the start snaps to beat 0', () => {
    const result = nearestBeat(1, 120, 0.6);
    expect(result.beat).toBe(0);
    expect(result.offset).toBeCloseTo(-0.4, 10);
  });
});
