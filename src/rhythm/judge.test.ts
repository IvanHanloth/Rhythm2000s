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

  it('离目标更远的输入不计分', () => {
    const judge = new ResponseJudge([1]);
    expect(judge.tap(0.5)).toBeNull();
    expect(judge.tap(0.79)).toBeNull();
    expect(judge.result(0)).toBeNull();
  });

  it('比目标早、在 Good 窗口外但在提前范围内的输入，把目标判为 Miss', () => {
    const judge = new ResponseJudge([1, 2]);
    expect(judge.tap(0.85)).toEqual({ target: 0, level: 'miss', offset: null, time: 0.85 });
    // 这个目标已经判过，之后踩准也不算
    expect(judge.tap(1)).toBeNull();
    expect(judge.result(1)).toBeNull();
  });

  it('提前按只罚最早一个窗口还没关闭的目标', () => {
    const judge = new ResponseJudge([1, 1.25]);
    judge.tap(1);
    // 第一个已命中；紧接着多按一下，落在第二个的提前范围里
    expect(judge.tap(1.1)?.target).toBe(1);
    expect(judge.result(1)?.level).toBe('miss');

    // 窗口已过、还没 expire 的目标不挡住后面的目标
    const late = new ResponseJudge([1, 1.3]);
    expect(late.tap(1.15)).toMatchObject({ target: 1, level: 'miss' });
    expect(late.expire(1.2).map((j) => j.target)).toEqual([0]);
  });

  it('一直连按拿不到命中：每个目标都先被提前按判为 Miss', () => {
    const targets = [1, 1.5, 2, 2.25, 3];
    const judge = new ResponseJudge(targets);
    for (let time = 0; time < 3.5; time += 0.03) {
      judge.expire(time);
      judge.tap(time);
    }
    judge.expire(4);
    expect(targets.map((_, i) => judge.result(i)?.level)).toEqual(targets.map(() => 'miss'));
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
