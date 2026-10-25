// Combo (doc/combo.md): hits in a row across a level's chart pieces. Feedback only; the score ignores it. No PixiJS.

import type { JudgementLevel } from './judge.ts';

/** Combo where each tier starts (doc/combo.md "Tiers") */
export const COMBO_TIERS = [8, 16, 30] as const;
/** Losing at least this many plays the scene's break effect; shorter combos only reset the counter */
export const COMBO_BREAK_MIN = 10;

/** 0 below the first tier */
export type ComboTier = 0 | 1 | 2 | 3;

/** A tier with an effect */
export type EffectTier = Exclude<ComboTier, 0>;

/** The effects a combo at `tier` shows in a round: every tier up to it, as they add up (doc/combo.md "Tiers") */
export function tierEffects(tier: ComboTier): EffectTier[] {
  return ([1, 2, 3] as const).filter((t) => t <= tier);
}

export function comboTier(count: number): ComboTier {
  const [first, second, third] = COMBO_TIERS;
  if (count >= third) return 3;
  if (count >= second) return 2;
  return count >= first ? 1 : 0;
}

export interface ComboBreak {
  /** Heard time of the Miss (s) */
  time: number;
  /** The combo that was lost */
  lost: number;
}

export class ComboTracker {
  private current = 0;
  private longest = 0;
  private hitAt: number | null = null;
  private broke: ComboBreak | null = null;

  get count(): number {
    return this.current;
  }

  /** Longest combo so far, for the results */
  get best(): number {
    return this.longest;
  }

  get tier(): ComboTier {
    return comboTier(this.current);
  }

  /** Heard time of the last hit; null before any */
  get lastHit(): number | null {
    return this.hitAt;
  }

  /** The last reset of a running combo; null before any */
  get lastBreak(): ComboBreak | null {
    return this.broke;
  }

  /** One judged press of the chart at heard time `time` (s); returns the break when it resets a running combo */
  record(level: JudgementLevel, time: number): ComboBreak | null {
    if (level !== 'miss') {
      this.current++;
      this.longest = Math.max(this.longest, this.current);
      this.hitAt = time;
      return null;
    }
    if (this.current === 0) return null;
    this.broke = { time, lost: this.current };
    this.current = 0;
    return this.broke;
  }
}
