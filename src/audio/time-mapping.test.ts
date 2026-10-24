import { describe, expect, it } from 'vite-plus/test';
import { heardTimeFromCurrentTime, heardTimeFromStamp, isUsableStamp } from './time-mapping.ts';

describe('isUsableStamp', () => {
  it('音频尚未流动时返回的 0 值不可用', () => {
    expect(isUsableStamp({ contextTime: 0, performanceTime: 0 })).toBe(false);
  });

  it('缺字段或为空时不可用', () => {
    expect(isUsableStamp(null)).toBe(false);
    expect(isUsableStamp({ contextTime: 1 })).toBe(false);
  });

  it('正常的时间对可用', () => {
    expect(isUsableStamp({ contextTime: 1.2, performanceTime: 5000 })).toBe(true);
  });
});

describe('heardTimeFromStamp', () => {
  it('输入发生在时间对之后 100 毫秒，听到的音频时间也往后 0.1 秒', () => {
    const stamp = { contextTime: 3, performanceTime: 10_000 };
    expect(heardTimeFromStamp(stamp, 10_100)).toBeCloseTo(3.1, 10);
  });

  it('输入早于时间对时往前推', () => {
    const stamp = { contextTime: 3, performanceTime: 10_000 };
    expect(heardTimeFromStamp(stamp, 9_950)).toBeCloseTo(2.95, 10);
  });
});

describe('heardTimeFromCurrentTime', () => {
  it('扣除回调延迟和浏览器报告的延迟', () => {
    // 事件发生在 20 毫秒前，浏览器报告的总延迟 30 毫秒
    expect(heardTimeFromCurrentTime(5, 1_020, 1_000, 0.03)).toBeCloseTo(4.95, 10);
  });
});
