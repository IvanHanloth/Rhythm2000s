// Scene catalog: each scene's name, supported actions and extra chart rules.
// No PixiJS, so the chart loader and unit tests can use it directly.

import type { ActionType } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { MAC_ACTION_TYPES } from './mac-2000/action-kinds.ts';
import { checkMacChart } from './mac-2000/chart-rules.ts';
import { MAC_ICON_IDS } from './mac-2000/system-icons.ts';
import { checkWindowsXpChart } from './windows-xp/chart-rules.ts';
import { XP_ICON_IDS } from './windows-xp/system-icons.ts';

export type SceneId = 'windows-xp' | 'mac-2000';

export interface SceneInfo {
  /** Display name */
  label: string;
  /** Actions this scene can perform */
  actions: readonly ActionType[];
  /** System icon IDs a chart can take as its level icon (doc/chart-format.md "Icon IDs") */
  icons: readonly string[];
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
      // Prototype: cuts to the 3D café (doc/cross-dimension.md)
      'chair-swivel',
    ],
    icons: XP_ICON_IDS,
    checkChart: checkWindowsXpChart,
  },
  'mac-2000': {
    label: 'Mac OS X (Aqua)',
    actions: MAC_ACTION_TYPES,
    icons: MAC_ICON_IDS,
    checkChart: checkMacChart,
  },
};

/** Actions each scene supports, for chart validation */
export function sceneActions(): Record<string, readonly ActionType[]> {
  return Object.fromEntries(Object.entries(SCENE_CATALOG).map(([id, info]) => [id, info.actions]));
}

/** System icon IDs each scene has, for chart validation */
export function sceneIcons(): Record<string, readonly string[]> {
  return Object.fromEntries(Object.entries(SCENE_CATALOG).map(([id, info]) => [id, info.icons]));
}
