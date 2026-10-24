// Mac 场景的六个动作：动作 ID → 部件种类、示范时的提示音（doc/scenes/mac-2000.md「玩法」「音效」）。
// 不依赖 PixiJS，谱面校验和单元测试都能直接用。

import type { ActionType } from '../../rhythm/actions.ts';

export type MacAction = Extract<
  ActionType,
  'alert-note' | 'alert-caution' | 'alert-stop' | 'dock-bounce' | 'mail-new' | 'window-miniaturize'
>;

/** 部件种类：提示框、Dock 弹跳、新邮件、文稿窗口 */
export type MacTargetKind = 'alert' | 'dock' | 'mail' | 'window';

/** assets/reference/mac-os-x/sounds/ 里的文件名（不含 .aiff） */
export type MacSoundName =
  | 'Basso'
  | 'Bottle'
  | 'Funk'
  | 'Glass'
  | 'Hero'
  | 'Ping'
  | 'Pop'
  | 'Sosumi'
  | 'Tink';

export interface MacActionInfo {
  kind: MacTargetKind;
  /** 示范段在拍点上响的提示音。原版提示框不分种类，这里为了区分各配一个，暂定 */
  sound: MacSoundName;
}

export const MAC_ACTIONS: Record<MacAction, MacActionInfo> = {
  'alert-note': { kind: 'alert', sound: 'Glass' },
  'alert-caution': { kind: 'alert', sound: 'Funk' },
  'alert-stop': { kind: 'alert', sound: 'Basso' },
  'dock-bounce': { kind: 'dock', sound: 'Pop' },
  'mail-new': { kind: 'mail', sound: 'Ping' },
  'window-miniaturize': { kind: 'window', sound: 'Bottle' },
};

export const MAC_ACTION_TYPES = Object.keys(MAC_ACTIONS) as MacAction[];

export function isMacAction(action: string): action is MacAction {
  return Object.hasOwn(MAC_ACTIONS, action);
}

/** 画面上能同时摆下的提示框 + 文稿窗口个数（每个乐句） */
export const MAX_WINDOWS_PER_PHRASE = 6;
/** Dock 上能拿来弹跳的程序个数（每个乐句） */
export const MAX_BOUNCES_PER_PHRASE = 8;
