import { describe, expect, it } from 'vite-plus/test';
import { median, suggestCalibration, summarize, trim } from './stats.ts';

describe('median', () => {
  it('takes the middle value for an odd count', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the middle two for an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('returns NaN for an empty array', () => {
    expect(median([])).toBeNaN();
  });

  it('does not modify the input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarize', () => {
  it('computes mean, median and population standard deviation', () => {
    const result = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toEqual({ count: 8, mean: 5, median: 4.5, stdDev: 2 });
  });

  it('everything is NaN for an empty array', () => {
    const result = summarize([]);
    expect(result.count).toBe(0);
    expect(result.mean).toBeNaN();
  });
});

describe('trim', () => {
  it('drops 10% from each end', () => {
    expect(trim([10, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.1)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('drops nothing when there are too few samples', () => {
    expect(trim([3, 1], 0.1)).toEqual([1, 3]);
  });
});

describe('suggestCalibration', () => {
  it('skips the first inputs and ignores outliers', () => {
    // The first 4 are flailing while finding the beat; the final 300 is a slip
    const offsets = [-200, 150, 90, -80, 30, 32, 28, 31, 29, 30, 33, 27, 30, 300];
    expect(suggestCalibration(offsets)).toBe(30);
  });

  it('returns null without enough samples', () => {
    expect(suggestCalibration([10, 20, 30, 40, 50])).toBeNull();
  });
});
