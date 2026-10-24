// The four XP actions on the taskbar, desktop and program windows (doc/scenes/windows-xp-levels.md):
// tray balloon, minimise window, Start menu, Recycle Bin. No PixiJS, so chart validation and tests can use it.

import type { ActionType } from '@/rhythm/actions.ts';
import type { XpSoundName } from './assets.ts';

export type ShellAction = Extract<
  ActionType,
  'balloon-info' | 'window-minimize' | 'start-menu' | 'recycle-bin'
>;

export interface ShellActionInfo {
  /** Cue on the call beat; start-menu's two presses use click sounds instead (song.ts hitSound) */
  appear: XpSoundName | null;
  /** Sound when hit in the response */
  handled: XpSoundName;
}

export const SHELL_ACTIONS: Record<ShellAction, ShellActionInfo> = {
  'balloon-info': { appear: 'balloon', handled: 'navigate' },
  'window-minimize': { appear: 'restore', handled: 'minimize' },
  'start-menu': { appear: null, handled: 'menuCommand' },
  'recycle-bin': { appear: 'fileDrop', handled: 'recycle' },
};

export function isShellAction(action: string): action is ShellAction {
  return Object.hasOwn(SHELL_ACTIONS, action);
}

/** Per-phrase limits set by the room on screen (doc/scenes/windows-xp-levels.md "Per-phrase limits") */
export const PHRASE_LIMITS = {
  /** Message boxes and program windows share 6 screen slots */
  windows: 6,
  /** Room for 4 program buttons on the taskbar besides "My Levels" */
  programs: 4,
  /** Only 3 tray icons to point at */
  balloons: 3,
  /** Room for 6 files in the desktop row */
  files: 6,
} as const;
