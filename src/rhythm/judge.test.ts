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
    expect(judge.tap(0.79)).toBeNull();
    expect(judge.result(0)).toBeNull();
  });

  it('an early input outside the Good window but inside the early range judges the target a Miss', () => {
    const judge = new ResponseJudge([1, 2]);
    expect(judge.tap(0.85)).toEqual({ target: 0, level: 'miss', offset: null, time: 0.85 });
    // That target is already judged; hitting it on time afterwards does not count
    expect(judge.tap(1)).toBeNull();
    expect(judge.result(1)).toBeNull();
  });

  it('an early press only penalises the earliest target whose window is still open', () => {
    const judge = new ResponseJudge([1, 1.25]);
    judge.tap(1);
    // The first is hit; one extra press right after lands in the second's early range
    expect(judge.tap(1.1)?.target).toBe(1);
    expect(judge.result(1)?.level).toBe('miss');

    // A target whose window has passed but has not expired yet does not block later targets
    const late = new ResponseJudge([1, 1.3]);
    expect(late.tap(1.15)).toMatchObject({ target: 1, level: 'miss' });
    expect(late.expire(1.2).map((j) => j.target)).toEqual([0]);
  });

  it('mashing never scores a hit: every target is judged a Miss by an early press first', () => {
    const targets = [1, 1.5, 2, 2.25, 3];
    const judge = new ResponseJudge(targets);
    for (let time = 0; time < 3.5; time += 0.03) {
      judge.expire(time);
      judge.tap(time);
    }
    judge.expire(4);
    expect(targets.map((_, i) => judge.result(i)?.level)).toEqual(targets.map(() => 'miss'));
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
