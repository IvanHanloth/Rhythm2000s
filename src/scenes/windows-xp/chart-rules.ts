// XP chart rules (doc/chart-format.md "Scene rules"): paired call and response, and per-phrase limits
// set by the room on screen (doc/scenes/windows-xp-levels.md).

import type { Chart, ChartCue } from '@/rhythm/chart.ts';
import { checkPairedPhrases, overLimits } from '@/scenes/shared/chart-rules.ts';
import { isDialogKind } from './dialog-kinds.ts';
import { PHRASE_LIMITS } from './shell-actions.ts';

export function checkWindowsXpChart(chart: Chart): string[] {
  return checkPairedPhrases(chart, 'XP', checkPhraseLimits);
}

function checkPhraseLimits(phrase: number, calls: readonly ChartCue[]): string[] {
  const count = (test: (action: string) => boolean) => calls.filter((c) => test(c.action)).length;
  const programs = count((a) => a === 'window-minimize');
  return overLimits(phrase, 'XP', [
    [
      'message boxes and program windows',
      count((a) => isDialogKind(a)) + programs,
      PHRASE_LIMITS.windows,
    ],
    ['window-minimize', programs, PHRASE_LIMITS.programs],
    ['balloon-info', count((a) => a === 'balloon-info'), PHRASE_LIMITS.balloons],
    ['recycle-bin', count((a) => a === 'recycle-bin'), PHRASE_LIMITS.files],
  ]);
}
