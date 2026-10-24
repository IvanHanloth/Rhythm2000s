import { describe, expect, it } from 'vite-plus/test';
import { formatScore, summarizeResult, type HitResult } from './result-summary.ts';

const perfect = (offset: number, phrase = 0): HitResult => ({ level: 'perfect', offset, phrase });
const good = (offset: number, phrase = 0): HitResult => ({ level: 'good', offset, phrase });
const miss = (phrase = 0): HitResult => ({ level: 'miss', offset: null, phrase });

describe('summarizeResult', () => {
  it('Perfect 1 分、Good 半分、Miss 0 分，换算成满分 10000', () => {
    const summary = summarizeResult([perfect(0), perfect(0), good(0.06), miss()]);
    expect(summary.counts).toEqual({ perfect: 2, good: 1, miss: 1 });
    expect(summary.score).toBe(6250);
    expect(summary.rank).toBe('ok');
  });

  it('8000 分以上优秀，6000 分以下再试一次', () => {
    expect(summarizeResult([perfect(0), perfect(0), perfect(0), perfect(0), good(0.06)]).rank).toBe(
      'superb',
    );
    expect(summarizeResult([perfect(0), miss()]).rank).toBe('tryAgain');
  });

  it('偏差按 20 毫秒分格，超出 ±100 毫秒的归到两端', () => {
    const { bins } = summarizeResult([perfect(0), perfect(0.009), good(-0.061), good(0.15)]);
    expect(bins).toEqual([0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1]);
  });

  it('评语：总体评价、出错的乐句、整体偏晚提示', () => {
    const summary = summarizeResult([
      perfect(0.03, 0),
      perfect(0.03, 0),
      perfect(0.03, 1),
      perfect(0.03, 1),
      miss(3),
      miss(6),
    ]);
    expect(summary.missedPhrases).toEqual([4, 7]);
    expect(summary.meanOffsetMs).toBeCloseTo(30, 6);
    expect(summary.comments).toEqual([
      '大体跟上了节奏。',
      '第 4、7 乐句有失误。',
      '整体偏晚 30 毫秒，可以试试重新校准。',
    ]);
  });

  it('没有失误、时机居中时这么说；命中太少时不评价时机', () => {
    const steady = summarizeResult([perfect(0.01), perfect(-0.01), perfect(0), perfect(0)]);
    expect(steady.comments.slice(1)).toEqual(['没有失误。', '按键时机没有明显偏早或偏晚。']);
    expect(summarizeResult([perfect(0.05)]).comments).toHaveLength(2);
  });

  it('一个乐句以上的失误最多列 3 个', () => {
    const summary = summarizeResult([miss(0), miss(1), miss(2), miss(3)]);
    expect(summary.comments[1]).toBe('第 1、2、3 等乐句有失误。');
    expect(summary.score).toBe(0);
    expect(summary.meanOffsetMs).toBeNull();
  });
});

describe('formatScore', () => {
  it('补成五位数', () => {
    expect(formatScore(8250)).toBe('08250');
    expect(formatScore(10000)).toBe('10000');
  });
});
