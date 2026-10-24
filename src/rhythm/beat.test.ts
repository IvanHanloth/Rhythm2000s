import { describe, expect, it } from 'vite-plus/test';
import { beatToTime, nearestBeat, secondsPerBeat, timeToBeat } from './beat.ts';

describe('secondsPerBeat', () => {
  it('120 BPM 每拍 0.5 秒', () => {
    expect(secondsPerBeat(120)).toBe(0.5);
  });

  it('拒绝非正数 BPM', () => {
    expect(() => secondsPerBeat(0)).toThrow(RangeError);
    expect(() => secondsPerBeat(-60)).toThrow(RangeError);
    expect(() => secondsPerBeat(Number.NaN)).toThrow(RangeError);
  });
});

describe('beatToTime / timeToBeat', () => {
  it('互为反函数', () => {
    const start = 1.25;
    for (const beat of [0, 1, 3.5, 17]) {
      expect(timeToBeat(start, 90, beatToTime(start, 90, beat))).toBeCloseTo(beat, 10);
    }
  });

  it('开始之前的时间得到负的拍位置', () => {
    expect(timeToBeat(2, 120, 1.5)).toBe(-1);
  });
});

describe('nearestBeat', () => {
  it('晚一点记为正偏差', () => {
    const result = nearestBeat(1, 120, 2.03);
    expect(result.beat).toBe(2);
    expect(result.offset).toBeCloseTo(0.03, 10);
  });

  it('早一点记为负偏差', () => {
    const result = nearestBeat(1, 120, 1.97);
    expect(result.beat).toBe(2);
    expect(result.offset).toBeCloseTo(-0.03, 10);
  });

  it('开始之前的输入归到第 0 拍', () => {
    const result = nearestBeat(1, 120, 0.6);
    expect(result.beat).toBe(0);
    expect(result.offset).toBeCloseTo(-0.4, 10);
  });
});
