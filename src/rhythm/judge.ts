// Judging: matches player input to response targets and grades Perfect / Good / Miss.
// Times are in seconds on the audio timeline; input times must already have the calibration subtracted.

export type JudgementLevel = 'perfect' | 'good' | 'miss';

export interface JudgeWindows {
  /** Half-width of Perfect (s): an absolute offset up to this is Perfect */
  perfect: number;
  /** Half-width of Good (s): up to this is Good, beyond it is a Miss */
  good: number;
}

/** Provisional MVP windows, see doc/prototypes/mvp.md */
export const MVP_WINDOWS: JudgeWindows = { perfect: 0.045, good: 0.1 };

export interface Judgement {
  /** Target index */
  target: number;
  level: JudgementLevel;
  /** Offset (s), positive is late; null for a Miss */
  offset: number | null;
  /** When the judgement happened (s): the input time for hits, the moment the Good window closed for Misses */
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
   * Returns null when no target is near; such a press neither scores nor costs anything.
   */
  tap(time: number): Judgement | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      const level = levelForOffset(offset, this.windows);
      if (level) {
        const judgement: Judgement = { target: i, level, offset, time };
        this.results[i] = judgement;
        return judgement;
      }
    }
    return null;
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
