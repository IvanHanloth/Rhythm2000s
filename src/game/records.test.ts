import { describe, expect, it } from 'vite-plus/test';
import { isBetter, mergeResult, parseRecords } from './records.ts';

describe('isBetter', () => {
  it('没有记录时任何成绩都算更好', () => {
    expect(isBetter({ perfect: 0, good: 0, miss: 9 }, undefined)).toBe(true);
  });

  it('Perfect 算 2 分、Good 算 1 分', () => {
    const best = { perfect: 3, good: 0, miss: 1 };
    expect(isBetter({ perfect: 2, good: 3, miss: 0 }, best)).toBe(true);
    expect(isBetter({ perfect: 2, good: 1, miss: 1 }, best)).toBe(false);
  });

  it('分数相同时 Miss 少的更好', () => {
    const best = { perfect: 2, good: 2, miss: 2 };
    expect(isBetter({ perfect: 3, good: 0, miss: 1 }, best)).toBe(true);
    expect(isBetter({ perfect: 3, good: 0, miss: 2 }, best)).toBe(false);
  });
});

describe('mergeResult', () => {
  it('更好时覆盖，否则原样返回', () => {
    const records = { a: { perfect: 5, good: 0, miss: 0 } };
    expect(mergeResult(records, 'a', { perfect: 1, good: 0, miss: 4 })).toBe(records);
    expect(mergeResult(records, 'b', { perfect: 1, good: 0, miss: 4 }).b).toEqual({
      perfect: 1,
      good: 0,
      miss: 4,
    });
  });
});

describe('parseRecords', () => {
  it('坏掉的存档当作没有记录，格式不对的条目丢掉', () => {
    expect(parseRecords(null)).toEqual({});
    expect(parseRecords('{oops')).toEqual({});
    expect(
      parseRecords(
        JSON.stringify({
          ok: { perfect: 1, good: 2, miss: 0 },
          bad: { perfect: -1, good: 0, miss: 0 },
        }),
      ),
    ).toEqual({ ok: { perfect: 1, good: 2, miss: 0 } });
  });
});
