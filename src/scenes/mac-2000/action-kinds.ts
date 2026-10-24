// Mac 场景的动作：动作 ID → 部件种类、示范时的提示音（doc/scenes/mac-2000.md「玩法」「音效」）。
// 不依赖 PixiJS，谱面校验和单元测试都能直接用。

import type { ActionType } from '../../rhythm/actions.ts';

export type MacAction = Extract<
  ActionType,
  | 'alert-note'
  | 'alert-caution'
  | 'alert-stop'
  | 'dock-bounce'
  | 'mail-new'
  | 'window-miniaturize'
  | 'menu-apple'
  | 'dock-trash'
  | 'sheet-save'
  | 'ichat-message'
  | 'menu-volume'
>;

/**
 * 部件种类：提示框、Dock 弹跳、新邮件、文稿窗口、苹果菜单、扔进废纸篓的文件、
 * 带存储表单的窗口、iChat 消息窗、菜单栏音量
 */
export type MacTargetKind =
  | 'alert'
  | 'dock'
  | 'mail'
  | 'window'
  | 'menu'
  | 'file'
  | 'sheet'
  | 'chat'
  | 'volume';

/** assets/reference/mac-os-x/sounds/ 里的文件名（不含 .aiff） */
export type MacSoundName =
  | 'Basso'
  | 'Blow'
  | 'Bottle'
  | 'Frog'
  | 'Funk'
  | 'Glass'
  | 'Hero'
  | 'Morse'
  | 'Ping'
  | 'Pop'
  | 'Purr'
  | 'Sosumi'
  | 'Submarine'
  | 'Tink';

export interface MacActionInfo {
  kind: MacTargetKind;
  /** 示范段在拍点上响的提示音。原版提示框不分种类，这里为了区分各配一个，暂定 */
  sound: MacSoundName;
  /**
   * 跟打段每一下命中时的声音，按第几下排；不写时都是 Tink。
   * 示范段要按两下的动作，第二下以后也按这里在拍点上预约（第一下是 sound）。
   */
  handled?: readonly MacSoundName[];
}

export const MAC_ACTIONS: Record<MacAction, MacActionInfo> = {
  'alert-note': { kind: 'alert', sound: 'Glass' },
  'alert-caution': { kind: 'alert', sound: 'Funk' },
  'alert-stop': { kind: 'alert', sound: 'Basso' },
  'dock-bounce': { kind: 'dock', sound: 'Pop' },
  'mail-new': { kind: 'mail', sound: 'Ping' },
  'window-miniaturize': { kind: 'window', sound: 'Bottle' },
  // 第一下点苹果、菜单落下，第二下点菜单项（原版都没有声音，暂定）
  'menu-apple': { kind: 'menu', sound: 'Morse', handled: ['Morse', 'Tink'] },
  // 文件落下 / 扔进废纸篓（原版的揉纸声本地没有，暂定）
  'dock-trash': { kind: 'file', sound: 'Purr', handled: ['Blow'] },
  // 第一下点关闭按钮、表单滑出，第二下点「Don't Save」（原版都没有声音，暂定）
  'sheet-save': { kind: 'sheet', sound: 'Frog', handled: ['Frog', 'Tink'] },
  // iChat 原版的新消息提示音本地没有，暂定
  'ichat-message': { kind: 'chat', sound: 'Submarine' },
  // 按下滑块 / 松开（原版松开时按新音量响一声，暂定）
  'menu-volume': { kind: 'volume', sound: 'Tink', handled: ['Tink', 'Pop'] },
};

export const MAC_ACTION_TYPES = Object.keys(MAC_ACTIONS) as MacAction[];

export function isMacAction(action: string): action is MacAction {
  return Object.hasOwn(MAC_ACTIONS, action);
}

/** 这个动作第 step 下命中时的声音 */
export function macHandledSound(action: MacAction, step: number): MacSoundName {
  return MAC_ACTIONS[action].handled?.[step] ?? 'Tink';
}

/** 画面上能同时摆下的提示框 + 文稿窗口个数（每个乐句） */
export const MAX_WINDOWS_PER_PHRASE = 6;
/** Dock 上能拿来弹跳的程序个数（每个乐句） */
export const MAX_BOUNCES_PER_PHRASE = 8;
/** Dock 上方那一行摆得下的文件个数（每个乐句） */
export const MAX_FILES_PER_PHRASE = 6;
/** iChat 图标上方叠得下的消息窗个数（每个乐句） */
export const MAX_CHATS_PER_PHRASE = 3;

/** 占用画面上那 6 个窗口位置的部件种类 */
export function usesWindowSlot(kind: MacTargetKind): boolean {
  return kind === 'alert' || kind === 'window' || kind === 'sheet';
}
