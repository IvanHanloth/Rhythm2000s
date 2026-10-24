import { describe, expect, it } from 'vite-plus/test';
import { levelForOffset, MVP_WINDOWS, ResponseJudge } from './judge.ts';

describe('levelForOffset', () => {
  it('grades by absolute offset, boundaries included', () => {
    expect(levelForOffset(0, MVP_WINDOWS)).toBe('perfect');
    expect(levelForOffset(-0.045, MVP_WINDOWS)).toBe('perfect');
    expect(levelForOffset(0.046, MVP_WINDOWS)).toBe('good');
    expect(levelForOffset(-0.1, MVP_WINDOWS)).toBe('good');
    expect(levelForOffset(0.101, MVP_WINDOWS)).toBeNull();
  });
});

describe('ResponseJudge', () => {
  it('matches input to a target inside the window and reports the offset', () => {
    const judge = new ResponseJudge([1, 2]);
    const result = judge.tap(2.06);

    expect(result?.target).toBe(1);
    expect(result?.level).toBe('good');
    expect(result?.offset).toBeCloseTo(0.06, 10);
  });

  it('judges each target once; pressing again does nothing', () => {
    const judge = new ResponseJudge([1]);
    expect(judge.tap(1)?.level).toBe('perfect');
    expect(judge.tap(1.01)).toBeNull();
  });

  it('input with no target nearby does not count', () => {
    const judge = new ResponseJudge([1]);
    expect(judge.tap(0.5)).toBeNull();
    expect(judge.result(0)).toBeNull();
  });

  it('when two targets are in the window, takes the earliest unjudged one', () => {
    const judge = new ResponseJudge([1, 1.15]);
    expect(judge.tap(1.08)?.target).toBe(0);
    expect(judge.tap(1.1)?.target).toBe(1);
  });

  it('no input by the end of the Good window is a Miss, timed when the window closes', () => {
    const judge = new ResponseJudge([1, 2]);

    expect(judge.expire(1.1)).toEqual([]);
    expect(judge.expire(1.2)).toEqual([{ target: 0, level: 'miss', offset: null, time: 1.1 }]);
    expect(judge.expire(1.3)).toEqual([]);
    expect(judge.allJudged).toBe(false);

    judge.tap(2);
    expect(judge.allJudged).toBe(true);
  });

  it('hit targets never become Misses', () => {
    const judge = new ResponseJudge([1, 2]);
    judge.tap(1);
    expect(judge.expire(5).map((j) => j.target)).toEqual([1]);
  });
});
