import { describe, expect, it } from 'vite-plus/test';
import { StepJudge } from './step-judge.ts';

const targets = [
  { time: 1, keys: ['left'] as const },
  { time: 2, keys: ['left', 'up'] as const },
  { time: 3, keys: ['up'] as const },
];

describe('StepJudge', () => {
  it('grades a single arrow by its offset', () => {
    const judge = new StepJudge(targets);
    expect(judge.press('left', 1.03)?.judgement).toMatchObject({ step: 0, level: 'perfect' });
    expect(judge.press('up', 3.1)?.judgement).toMatchObject({ step: 2, level: 'good' });
  });

  it('ignores a key the step does not need', () => {
    const judge = new StepJudge(targets);
    expect(judge.press('down', 1)).toBeNull();
    expect(judge.result(0)).toBeNull();
  });

  it('judges a diagonal once both keys are down, by the worse press', () => {
    const judge = new StepJudge(targets);
    judge.press('left', 1);
    const first = judge.press('up', 2.01);
    expect(first).toEqual({ step: 1, judgement: null });
    expect(judge.isPressed(1, 'up')).toBe(true);
    const second = judge.press('left', 2.1);
    expect(second?.judgement).toMatchObject({ step: 1, level: 'good' });
    expect(second?.judgement?.offset).toBeCloseTo(0.1);
  });

  it('misses a diagonal with only one key down when its window closes', () => {
    const judge = new StepJudge(targets);
    judge.press('left', 1);
    judge.press('up', 2);
    expect(judge.expire(2.2)).toEqual([{ step: 1, level: 'miss', offset: null, time: 2.13 }]);
  });

  it('a press matches the earliest step needing that key inside the window', () => {
    const judge = new StepJudge([
      { time: 1, keys: ['left'] },
      { time: 1.1, keys: ['left'] },
    ]);
    expect(judge.press('left', 1.08)?.step).toBe(0);
    expect(judge.press('left', 1.1)?.step).toBe(1);
  });

  it('an early press on the next step is a Miss; earlier presses do nothing', () => {
    const judge = new StepJudge(targets);
    expect(judge.press('left', 0.6)).toBeNull();
    expect(judge.press('left', 0.8)?.judgement).toMatchObject({ step: 0, level: 'miss' });
  });

  it('expires unpressed steps as Misses in order', () => {
    const judge = new StepJudge(targets);
    expect(judge.expire(1.1)).toEqual([]);
    expect(judge.expire(2.5).map((j) => j.step)).toEqual([0, 1]);
    expect(judge.allJudged).toBe(false);
    judge.expire(4);
    expect(judge.allJudged).toBe(true);
  });

  it('with the cheat on, presses are Perfect and steps play themselves on time', () => {
    const judge = new StepJudge(targets);
    expect(judge.press('left', 1.12, true)?.judgement).toMatchObject({ level: 'perfect' });
    expect(judge.expire(1.99, true)).toEqual([]);
    expect(judge.expire(3, true)).toEqual([
      { step: 1, level: 'perfect', offset: 0, time: 2 },
      { step: 2, level: 'perfect', offset: 0, time: 3 },
    ]);
  });
});
