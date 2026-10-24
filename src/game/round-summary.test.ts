import { describe, expect, it } from 'vite-plus/test';
import { formatScore, ratingFor, summarize, type RoundJudgement } from './round-summary.ts';

function result(judgements: RoundJudgement[]) {
  return { chartId: 'c', title: 't', sceneId: 's', judgements };
}

const perfect = (offsetMs: number, phrase = 0): RoundJudgement => ({
  level: 'perfect',
  offset: offsetMs / 1000,
  phrase,
});
const good = (offsetMs: number, phrase = 0): RoundJudgement => ({
  level: 'good',
  offset: offsetMs / 1000,
  phrase,
});
const miss = (phrase = 0): RoundJudgement => ({ level: 'miss', offset: null, phrase });

describe('ratingFor', () => {
  it('按命中率分三档', () => {
    expect(ratingFor(1)).toBe('superb');
    expect(ratingFor(0.85)).toBe('superb');
    expect(ratingFor(0.7)).toBe('ok');
    expect(ratingFor(0.59)).toBe('try-again');
  });
});

describe('summarize', () => {
  it('计数、得分、命中率', () => {
    const s = summarize(result([perfect(0), perfect(10), good(-70), miss()]));
    expect(s.counts).toEqual({ perfect: 2, good: 1, miss: 1 });
    expect(s.score).toBe(250);
    expect(s.accuracy).toBeCloseTo(2.5 / 4);
    expect(s.rating).toBe('ok');
  });

  it('偏差分布每 20 毫秒一格，超出范围的算进两头', () => {
    const s = summarize(result([perfect(0), perfect(5), good(-95), good(300)]));
    expect(s.histogram).toHaveLength(11);
    expect(s.histogram[5]).toBe(2);
    expect(s.histogram[0]).toBe(1);
    expect(s.histogram[10]).toBe(1);
  });

  it('平均偏差只算命中的', () => {
    const s = summarize(result([perfect(20), good(40), miss()]));
    expect(s.averageOffsetMs).toBeCloseTo(30);
    expect(summarize(result([miss()])).averageOffsetMs).toBeNull();
  });

  it('评语：漏掉的乐句、整体偏早或偏晚', () => {
    const late = summarize(result([perfect(30, 0), good(40, 1), perfect(25, 2), miss(3), miss(6)]));
    expect(late.comments).toContain('第 4、7 乐句有目标没有处理。');
    expect(late.comments.some((c) => c.includes('偏晚约 32 毫秒'))).toBe(true);

    const clean = summarize(result([perfect(1), perfect(-2), perfect(3)]));
    expect(clean.comments[0]).toBe('全部 Perfect。节拍已完全同步。');
    expect(clean.comments.some((c) => c.includes('按键时机很准'))).toBe(true);
  });
});

describe('formatScore', () => {
  it('补足五位', () => {
    expect(formatScore(8250)).toBe('08250');
    expect(formatScore(0)).toBe('00000');
  });
});
