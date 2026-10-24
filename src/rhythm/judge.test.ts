import { describe, expect, it } from 'vite-plus/test';
import { levelForOffset, MVP_WINDOWS, ResponseJudge } from './judge.ts';

describe('levelForOffset', () => {
  it('按偏差绝对值分级，边界值算在内', () => {
    expect(levelForOffset(0, MVP_WINDOWS)).toBe('perfect');
    expect(levelForOffset(-0.045, MVP_WINDOWS)).toBe('perfect');
    expect(levelForOffset(0.046, MVP_WINDOWS)).toBe('good');
    expect(levelForOffset(-0.1, MVP_WINDOWS)).toBe('good');
    expect(levelForOffset(0.101, MVP_WINDOWS)).toBeNull();
  });
});

describe('ResponseJudge', () => {
  it('输入对到窗口内的目标并给出偏差', () => {
    const judge = new ResponseJudge([1, 2]);
    const result = judge.tap(2.06);

    expect(result?.target).toBe(1);
    expect(result?.level).toBe('good');
    expect(result?.offset).toBeCloseTo(0.06, 10);
  });

  it('同一个目标只判定一次，再按就是无效输入', () => {
    const judge = new ResponseJudge([1]);
    expect(judge.tap(1)?.level).toBe('perfect');
    expect(judge.tap(1.01)).toBeNull();
  });

  it('附近没有目标的输入不计分', () => {
    const judge = new ResponseJudge([1]);
    expect(judge.tap(0.5)).toBeNull();
    expect(judge.result(0)).toBeNull();
  });

  it('两个目标都在窗口内时，先对最早还没判定的那个', () => {
    const judge = new ResponseJudge([1, 1.15]);
    expect(judge.tap(1.08)?.target).toBe(0);
    expect(judge.tap(1.1)?.target).toBe(1);
  });

  it('Good 窗口过去仍没有输入记为 Miss，时间是窗口关闭的那一刻', () => {
    const judge = new ResponseJudge([1, 2]);

    expect(judge.expire(1.1)).toEqual([]);
    expect(judge.expire(1.2)).toEqual([{ target: 0, level: 'miss', offset: null, time: 1.1 }]);
    expect(judge.expire(1.3)).toEqual([]);
    expect(judge.allJudged).toBe(false);

    judge.tap(2);
    expect(judge.allJudged).toBe(true);
  });

  it('已命中的目标不会再被记为 Miss', () => {
    const judge = new ResponseJudge([1, 2]);
    judge.tap(1);
    expect(judge.expire(5).map((j) => j.target)).toEqual([1]);
  });
});
