// Judging: matches player input to response targets and grades Perfect / Good / Miss.
// Times are in seconds on the audio timeline; input times must already have the calibration subtracted.

export type JudgementLevel = 'perfect' | 'good' | 'miss';

export interface JudgeWindows {
  /** Half-width of Perfect (s): an absolute offset up to this is Perfect */
  perfect: number;
  /** Half-width of Good (s): up to this is Good, beyond it is a Miss */
  good: number;
  /**
   * Early-press range (s): a press earlier than the Good window but within this marks the target a Miss,
   * so mashing cannot guess every target.
   */
  early: number;
}

/**
 * Provisional windows, see doc/prototypes/mvp.md. Widened on 2026-10-24 from 0.045 / 0.1 / 0.2 after play-testing.
 * Good can't grow past 0.13 without breaking xp-download.json's turn-cue timing (doc/chart-format.md "Timing limits").
 */
export const JUDGE_WINDOWS: JudgeWindows = { perfect: 0.06, good: 0.13, early: 0.25 };

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
  constructor(targets: readonly number[], windows: JudgeWindows = JUDGE_WINDOWS) {
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
   * `invincible` (the cheat code, doc/cheat-code.md): the same presses match, but each is Perfect; a press nearest to a
   * target already judged is that target's late press and does nothing, so it can't take the next target early.
   */
  tap(time: number, invincible = false): Judgement | null {
    if (invincible && this.nearestJudged(time)) return null;
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      const level = levelForOffset(offset, this.windows);
      if (level)
        return this.record({ target: i, level: invincible ? 'perfect' : level, offset, time });
    }
    return this.earlyMiss(time, invincible);
  }

  /** Early press: only the earliest unjudged target whose Good window is still open counts */
  private earlyMiss(time: number, invincible: boolean): Judgement | null {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.results[i]) continue;
      const offset = time - this.targets[i]!;
      // Skip targets whose window has closed; expire() marks them
      if (offset > this.windows.good) continue;
      if (offset < -this.windows.early) return null;
      if (invincible) return this.record({ target: i, level: 'perfect', offset, time });
      return this.record({ target: i, level: 'miss', offset: null, time });
    }
    return null;
  }

  /** Whether the target nearest to `time` is already judged */
  private nearestJudged(time: number): boolean {
    let nearest = -1;
    for (let i = 0; i < this.targets.length; i++) {
      if (
        nearest < 0 ||
        Math.abs(time - this.targets[i]!) < Math.abs(time - this.targets[nearest]!)
      ) {
        nearest = i;
      }
    }
    return nearest >= 0 && this.results[nearest] !== null;
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
