import { describe, expect, it } from 'vite-plus/test';
import { median, suggestCalibration, summarize, trim } from './stats.ts';

describe('median', () => {
  it('奇数个取中间值', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('偶数个取中间两个的平均', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('空数组返回 NaN', () => {
    expect(median([])).toBeNaN();
  });

  it('不修改原数组', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarize', () => {
  it('计算平均值、中位数和总体标准差', () => {
    const result = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toEqual({ count: 8, mean: 5, median: 4.5, stdDev: 2 });
  });

  it('空数组各项为 NaN', () => {
    const result = summarize([]);
    expect(result.count).toBe(0);
    expect(result.mean).toBeNaN();
  });
});

describe('trim', () => {
  it('两端各去掉 10%', () => {
    expect(trim([10, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.1)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('样本太少时不去掉', () => {
    expect(trim([3, 1], 0.1)).toEqual([1, 3]);
  });
});

describe('suggestCalibration', () => {
  it('跳过开头的输入，并忽略极端值', () => {
    // 前 4 次是找节奏时的乱按，最后一个 300 是失误
    const offsets = [-200, 150, 90, -80, 30, 32, 28, 31, 29, 30, 33, 27, 30, 300];
    expect(suggestCalibration(offsets)).toBe(30);
  });

  it('样本不够时返回 null', () => {
    expect(suggestCalibration([10, 20, 30, 40, 50])).toBeNull();
  });
});
