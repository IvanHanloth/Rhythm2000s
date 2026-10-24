// The four message box kinds: action ID → original constant, icon, buttons and alert sound
// (doc/scenes/windows-xp.md "Widgets", "Sounds").

import type { ActionType } from '@/rhythm/actions.ts';
import type { XpSoundName } from './assets.ts';

export type DialogKind = Extract<ActionType, `dialog-${string}`>;

export interface DialogKindInfo {
  /** The original MessageBox icon constant, for reference only */
  constant: string;
  /** File name under assets/reference/windows-xp/icons/ (without .png) */
  icon: string;
  /** Button labels; the first is the default */
  buttons: readonly string[];
  /** Sound when it pops up */
  sound: XpSoundName;
}

export const DIALOG_KINDS: Record<DialogKind, DialogKindInfo> = {
  'dialog-info': {
    constant: 'MB_ICONINFORMATION',
    icon: 'dialog-info',
    buttons: ['OK'],
    sound: 'asterisk',
  },
  'dialog-warning': {
    constant: 'MB_ICONWARNING',
    icon: 'dialog-warning',
    buttons: ['OK'],
    sound: 'exclamation',
  },
  'dialog-error': {
    constant: 'MB_ICONERROR',
    icon: 'dialog-error',
    buttons: ['OK'],
    sound: 'criticalStop',
  },
  'dialog-question': {
    constant: 'MB_ICONQUESTION',
    icon: 'dialog-question',
    buttons: ['Yes', 'No'],
    sound: 'question',
  },
};

export function isDialogKind(action: string): action is DialogKind {
  return Object.hasOwn(DIALOG_KINDS, action);
}
