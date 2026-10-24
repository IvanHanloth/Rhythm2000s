// Scene catalog: each scene's name, supported actions and extra chart rules.
// No PixiJS, so the chart loader and unit tests can use it directly.

import type { ActionType } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { MAC_ACTION_TYPES } from './mac-2000/action-kinds.ts';
import { checkMacChart } from './mac-2000/chart-rules.ts';
import { checkWindowsXpChart } from './windows-xp/chart-rules.ts';

export type SceneId = 'windows-xp' | 'mac-2000';

export interface SceneInfo {
  /** Display name */
  label: string;
  /** Actions this scene can perform */
  actions: readonly ActionType[];
  /** Rules beyond the common validation; returns error messages */
  checkChart?(chart: Chart): string[];
}

export const SCENE_CATALOG: Record<SceneId, SceneInfo> = {
  'windows-xp': {
    label: 'Windows XP',
    actions: [
      'dialog-info',
      'dialog-warning',
      'dialog-error',
      'dialog-question',
      'desktop-refresh',
      'balloon-info',
      'window-minimize',
      'start-menu',
      'recycle-bin',
      'progress-download',
      'volume-mute',
    ],
    checkChart: checkWindowsXpChart,
  },
  'mac-2000': {
    label: 'Mac OS X (Aqua)',
    actions: MAC_ACTION_TYPES,
    checkChart: checkMacChart,
  },
};

/** Actions each scene supports, for chart validation */
export function sceneActions(): Record<string, readonly ActionType[]> {
  return Object.fromEntries(Object.entries(SCENE_CATALOG).map(([id, info]) => [id, info.actions]));
}
