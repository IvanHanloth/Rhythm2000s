// Dance machine judging (doc/dance-machine.md "Judging"): a press of one key matches the earliest unjudged step that
// needs that key inside the Good window. A diagonal is one target: it is judged once both its keys are down, by the
// worse press.
// Times are heard times on the audio timeline with the calibration already subtracted. No PixiJS.

import {
  JUDGE_WINDOWS,
  levelForOffset,
  type JudgeWindows,
  type JudgementLevel,
} from '@/rhythm/judge.ts';
import type { Arrow } from './steps.ts';

export interface StepTarget {
  /** Audio time of the step (s) */
  time: number;
  /** The keys the step's direction needs: one, or two for a diagonal */
  keys: readonly Arrow[];
}

export interface StepJudgement {
  /** Step index */
  step: number;
  level: JudgementLevel;
  /** Offset of the step's worse press (s, positive is late); null for a Miss */
  offset: number | null;
  /** The press that finished the step, or when its Good window closed for a missed step */
  time: number;
}

/** What one press did */
export interface StepPress {
  /** The step the press landed on */
  step: number;
  /** Set when the press finished the step (its last key) or made it an early Miss */
  judgement: StepJudgement | null;
}

interface ArrowPress {
  level: JudgementLevel;
  offset: number;
}

export class StepJudge {
  private readonly targets: readonly StepTarget[];
  private readonly windows: JudgeWindows;
  private readonly results: (StepJudgement | null)[];
  private readonly presses: Map<Arrow, ArrowPress>[];

  /** targets in ascending time order */
  constructor(targets: readonly StepTarget[], windows: JudgeWindows = JUDGE_WINDOWS) {
    this.targets = targets;
    this.windows = windows;
    this.results = targets.map(() => null);
    this.presses = targets.map(() => new Map());
  }

  result(step: number): StepJudgement | null {
    return this.results[step] ?? null;
  }

  /** Whether a key of a step is already down (half of a diagonal waiting for the other foot) */
  isPressed(step: number, arrow: Arrow): boolean {
    return this.presses[step]?.has(arrow) === true;
  }

  get allJudged(): boolean {
    return this.results.every((r) => r !== null);
  }

  /**
   * One key pressed at `time`. Returns null when it neither lands on a step nor is early enough to cost one.
   * `invincible` (the cheat code, doc/cheat-code.md): the same presses match, but each is Perfect and none is early.
   */
  press(arrow: Arrow, time: number, invincible = false): StepPress | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (!this.waitsFor(i, arrow)) continue;
      const offset = time - this.targets[i]!.time;
      const level = levelForOffset(offset, this.windows);
      if (level) return this.pressArrow(i, arrow, invincible ? 'perfect' : level, offset, time);
    }
    return this.earlyPress(arrow, time, invincible);
  }

  /** An early press only counts against the earliest step needing that key whose Good window is still open */
  private earlyPress(arrow: Arrow, time: number, invincible: boolean): StepPress | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (!this.waitsFor(i, arrow)) continue;
      const offset = time - this.targets[i]!.time;
      if (offset > this.windows.good) continue;
      if (offset < -this.windows.early) return null;
      if (invincible) return this.pressArrow(i, arrow, 'perfect', offset, time);
      return { step: i, judgement: this.record({ step: i, level: 'miss', offset: null, time }) };
    }
    return null;
  }

  private waitsFor(step: number, arrow: Arrow): boolean {
    return (
      this.results[step] === null &&
      this.targets[step]!.keys.includes(arrow) &&
      !this.presses[step]!.has(arrow)
    );
  }

  private pressArrow(
    step: number,
    arrow: Arrow,
    level: ArrowPress['level'],
    offset: number,
    time: number,
  ): StepPress {
    const presses = this.presses[step]!;
    presses.set(arrow, { level, offset });
    if (presses.size < this.targets[step]!.keys.length) return { step, judgement: null };
    const worse = [...presses.values()].reduce((a, b) =>
      rank(b.level) > rank(a.level) ||
      (b.level === a.level && Math.abs(b.offset) > Math.abs(a.offset))
        ? b
        : a,
    );
    return {
      step,
      judgement: this.record({ step, level: worse.level, offset: worse.offset, time }),
    };
  }

  private record(judgement: StepJudgement): StepJudgement {
    this.results[judgement.step] = judgement;
    return judgement;
  }

  /**
   * Steps whose Good window has closed before `time` become Misses, even with one key of a diagonal down.
   * With `invincible` the cheat plays them instead: a step is Perfect once its time comes.
   */
  expire(time: number, invincible = false): StepJudgement[] {
    const judged: StepJudgement[] = [];
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const target = this.targets[i]!.time;
      if (invincible) {
        if (time < target) break;
        judged.push(this.record({ step: i, level: 'perfect', offset: 0, time: target }));
        continue;
      }
      const closeTime = target + this.windows.good;
      if (time <= closeTime) break;
      judged.push(this.record({ step: i, level: 'miss', offset: null, time: closeTime }));
    }
    return judged;
  }
}

/** Higher is worse */
const RANK: Record<JudgementLevel, number> = { perfect: 0, good: 1, miss: 2 };
function rank(level: JudgementLevel): number {
  return RANK[level];
}
