// Judging: matches player input to response targets and grades Perfect / Good / Miss.
// Times are in seconds on the audio timeline; input times must already have the calibration subtracted.

export type JudgementLevel = 'perfect' | 'good' | 'miss';

export interface JudgeWindows {
  /** Half-width of Perfect (s): an absolute offset up to this is Perfect */
  perfect: number;
  /** Half-width of Good (s): up to this is Good, beyond it is a Miss */
  good: number;
  /**
   * 提前按算 Miss 的范围（秒）：比目标早超过 good、但不超过它的输入，把目标判为 Miss。
   * 防止一直连按就能把每个目标都蒙中。
   */
  early: number;
}

/** Provisional MVP windows, see doc/prototypes/mvp.md */
export const MVP_WINDOWS: JudgeWindows = { perfect: 0.045, good: 0.1, early: 0.2 };

export interface Judgement {
  /** Target index */
  target: number;
  level: JudgementLevel;
  /** Offset (s), positive is late; null for a Miss */
  offset: number | null;
  /**
   * When the judgement happened (s): the input time for hits and early-press Misses,
   * the moment the Good window closed for missed targets
   */
  time: number;
}

/** Grade for an offset; null outside the Good window (the caller decides between Miss and a stray press). */
export function levelForOffset(offset: number, windows: JudgeWindows): JudgementLevel | null {
  const distance = Math.abs(offset);
  if (distance <= windows.perfect) return 'perfect';
  if (distance <= windows.good) return 'good';
  return null;
}

export class ResponseJudge {
  private readonly targets: readonly number[];
  private readonly windows: JudgeWindows;
  private readonly results: (Judgement | null)[];

  /** targets: times of the response targets (s), ascending */
  constructor(targets: readonly number[], windows: JudgeWindows = MVP_WINDOWS) {
    this.targets = targets;
    this.windows = windows;
    this.results = targets.map(() => null);
  }

  /** Judgement for target i; null until judged. */
  result(target: number): Judgement | null {
    return this.results[target] ?? null;
  }

  get allJudged(): boolean {
    return this.results.every((r) => r !== null);
  }

  /**
   * One input: matched to the earliest unjudged target whose offset is inside the Good window.
   * Otherwise, if the input is earlier than the earliest unjudged target but within the early range,
   * that target is judged a Miss. In every other case returns null; such a press neither scores nor costs anything.
   */
  tap(time: number): Judgement | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      const level = levelForOffset(offset, this.windows);
      if (level) return this.record({ target: i, level, offset, time });
    }
    return this.earlyMiss(time);
  }

  /** 提前按：只看最早一个 Good 窗口还没关闭的未判定目标 */
  private earlyMiss(time: number): Judgement | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      // 窗口已经关闭、等 expire 记 Miss 的目标跳过
      if (offset > this.windows.good) continue;
      if (offset < -this.windows.early) return null;
      return this.record({ target: i, level: 'miss', offset: null, time });
    }
    return null;
  }

  private record(judgement: Judgement): Judgement {
    this.results[judgement.target] = judgement;
    return judgement;
  }

  /** Marks targets whose Good window has passed with no input as Misses; returns the new Misses. */
  expire(time: number): Judgement[] {
    const missed: Judgement[] = [];
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const closeTime = this.targets[i]! + this.windows.good;
      if (time <= closeTime) break;
      const judgement: Judgement = { target: i, level: 'miss', offset: null, time: closeTime };
      this.results[i] = judgement;
      missed.push(judgement);
    }
    return missed;
  }
}
