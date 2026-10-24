// When chair-swivel's 3D cutaway runs (doc/cross-dimension.md): from the call beat in the call, and from the moment
// of a hit in the response (feedback follows the input); a Miss stays in 2D. Beats only, no PixiJS, so it is testable.

import { CHAIR_SWIVEL_BEATS } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import type { RoundTarget } from './round-session.ts';

/** The desktop crossfades out over the cutaway's first 1/16 and back in over its last (1/8 beat each at 2 beats) */
const DESKTOP_FADE = 1 / 16;

/** What the cutaway needs from a round */
export interface CutawayRound {
  readonly targets: readonly RoundTarget[];
  beatAt(time: number): number;
}

/** The chart contains chair-swivel, so the 3D café must be ready before its round starts */
export function hasCutaway(chart: Chart): boolean {
  return chart.calls.some((call) => call.action === 'chair-swivel');
}

/** How far through the cutaway (0 to below 1) the round is at `beat`, or null when none is running */
export function cutawayProgress(round: CutawayRound, beat: number): number | null {
  for (const target of round.targets) {
    if (target.call.action !== 'chair-swivel') continue;
    const starts = [target.call.beat];
    const press = target.clicks[0];
    if (!press) throw new Error('chair-swivel has no press');
    if (press.hitAt !== null) starts.push(round.beatAt(press.hitAt));
    for (const start of starts) {
      const into = beat - start;
      if (into >= 0 && into < CHAIR_SWIVEL_BEATS) return into / CHAIR_SWIVEL_BEATS;
    }
  }
  return null;
}

/** Opacity of the 2D desktop over the café, `progress` (0–1) of the way through the cutaway */
export function cutawayDesktopAlpha(progress: number): number {
  const out = 1 - progress / DESKTOP_FADE;
  const back = (progress - (1 - DESKTOP_FADE)) / DESKTOP_FADE;
  return Math.min(1, Math.max(0, out, back));
}
