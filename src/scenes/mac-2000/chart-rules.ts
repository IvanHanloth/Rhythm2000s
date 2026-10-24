// Mac chart rules (doc/chart-format.md "Scene rules"): paired call and response, and per-phrase limits
// set by the screen slots and Dock icons available.

import type { Chart, ChartCue } from '../../rhythm/chart.ts';
import { checkPairedPhrases, overLimits } from '../shared/chart-rules.ts';
import {
  isMacAction,
  MAC_ACTIONS,
  MAX_BOUNCES_PER_PHRASE,
  MAX_CHATS_PER_PHRASE,
  MAX_FILES_PER_PHRASE,
  MAX_WINDOWS_PER_PHRASE,
  usesWindowSlot,
} from './action-kinds.ts';

export function checkMacChart(chart: Chart): string[] {
  return checkPairedPhrases(chart, 'Mac', checkPhraseLimits);
}

function checkPhraseLimits(phrase: number, calls: readonly ChartCue[]): string[] {
  const kinds = calls.flatMap((c) => (isMacAction(c.action) ? [MAC_ACTIONS[c.action].kind] : []));
  const count = (test: (kind: (typeof kinds)[number]) => boolean) => kinds.filter(test).length;
  return overLimits(phrase, 'Mac', [
    ['alerts and windows', count(usesWindowSlot), MAX_WINDOWS_PER_PHRASE],
    ['dock-bounce', count((k) => k === 'dock'), MAX_BOUNCES_PER_PHRASE],
    ['ichat-message', count((k) => k === 'chat'), MAX_CHATS_PER_PHRASE],
    ['dock-trash', count((k) => k === 'file'), MAX_FILES_PER_PHRASE],
  ]);
}
