import { describe, expect, it } from 'vite-plus/test';
import { heardTimeFromCurrentTime, heardTimeFromStamp, isUsableStamp } from './time-mapping.ts';

describe('isUsableStamp', () => {
  it('the zeros returned before audio flows are unusable', () => {
    expect(isUsableStamp({ contextTime: 0, performanceTime: 0 })).toBe(false);
  });

  it('missing or empty fields are unusable', () => {
    expect(isUsableStamp(null)).toBe(false);
    expect(isUsableStamp({ contextTime: 1 })).toBe(false);
  });

  it('a normal timestamp pair is usable', () => {
    expect(isUsableStamp({ contextTime: 1.2, performanceTime: 5000 })).toBe(true);
  });
});

describe('heardTimeFromStamp', () => {
  it('input 100 ms after the pair maps 0.1 s later in audio time', () => {
    const stamp = { contextTime: 3, performanceTime: 10_000 };
    expect(heardTimeFromStamp(stamp, 10_100)).toBeCloseTo(3.1, 10);
  });

  it('input before the pair maps earlier', () => {
    const stamp = { contextTime: 3, performanceTime: 10_000 };
    expect(heardTimeFromStamp(stamp, 9_950)).toBeCloseTo(2.95, 10);
  });
});

describe('heardTimeFromCurrentTime', () => {
  it('subtracts the callback delay and the reported latency', () => {
    // The event happened 20 ms ago; the browser reports 30 ms total latency
    expect(heardTimeFromCurrentTime(5, 1_020, 1_000, 0.03)).toBeCloseTo(4.95, 10);
  });
});
