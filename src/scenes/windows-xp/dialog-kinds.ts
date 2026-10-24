// 四种消息框（MessageBox）：动作 ID → 原版常量、图标、按钮、弹出时的提示音。
// 对应关系见 doc/scenes/windows-xp.md「界面部件」「音效」。

import type { ActionType } from '../../rhythm/actions.ts';
import type { XpSoundName } from './assets.ts';

export type DialogKind = Extract<ActionType, `dialog-${string}`>;

export interface DialogKindInfo {
  /** 原版 MessageBox 的图标常量，只用于说明 */
  constant: string;
  /** assets/reference/windows-xp/icons/ 下的文件名（不含 .png） */
  icon: string;
  /** 按钮文字，第一个是默认按钮 */
  buttons: readonly string[];
  /** 弹出时的提示音 */
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
