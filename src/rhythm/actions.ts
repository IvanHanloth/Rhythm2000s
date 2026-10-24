// 动作 ID：示范段出现的界面部件，按原版系统的类名或常量名取名（doc/chart-format.md、ADR 0006）。
// 写成「部件-变体」，例如 XP 消息框的 MB_ICONINFORMATION → dialog-info，Mac 的 kAlertNoteAlert → alert-note。
// 玩家在跟打段要对它做什么由部件决定；每个场景声明自己支持哪些动作。

export const ACTION_TYPES = [
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
  'alert-note',
  'alert-caution',
  'alert-stop',
  'dock-bounce',
  'mail-new',
  'window-miniaturize',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  'dialog-info': '信息消息框',
  'dialog-warning': '警告消息框',
  'dialog-error': '错误消息框',
  'dialog-question': '询问消息框',
  'desktop-refresh': '右键刷新',
  'balloon-info': '托盘气泡',
  'window-minimize': '最小化程序窗口',
  'start-menu': '开始菜单',
  'recycle-bin': '扔进回收站',
  // 2026-10-24 起新增的显示文字只用英文
  'progress-download': 'File download',
  'volume-mute': 'Volume control',
  'alert-note': 'Mac 提示框',
  'alert-caution': 'Mac 警告提示框',
  'alert-stop': 'Mac 停止提示框',
  'dock-bounce': 'Dock 图标弹跳',
  'mail-new': '新邮件',
  'window-miniaturize': '最小化窗口',
};

/**
 * 一个动作要按几下：每一下相对事件拍位置的偏移（拍）。大多数动作只按一下（[0]）；
 * desktop-refresh 先右键、0.5 拍后点「刷新」（doc/chart-format.md，2026-10-24 用户定为固定间隔）；
 * start-menu 先按「开始」、0.5 拍后点菜单项（doc/scenes/windows-xp-levels.md）；
 * progress-download 要等进度条走 2 拍，走满那一拍才点；volume-mute 拍点上按下、1 拍后松开。
 */
const TAP_OFFSETS: Partial<Record<ActionType, readonly number[]>> = {
  'desktop-refresh': [0, 0.5],
  'start-menu': [0, 0.5],
  'progress-download': [2],
  'volume-mute': [0, 1],
};

/** 每一下是按下还是松开。只有长按的动作有「松开」，玩家要从上一下一直按住 */
export type TapKind = 'press' | 'release';
const TAP_KINDS: Partial<Record<ActionType, readonly TapKind[]>> = {
  'volume-mute': ['press', 'release'],
};

/** 这个动作第 step 下是按下还是松开 */
export function actionTapKind(action: ActionType, step: number): TapKind {
  return TAP_KINDS[action]?.[step] ?? 'press';
}
const SINGLE_TAP: readonly number[] = [0];

export function actionTapOffsets(action: ActionType): readonly number[] {
  return TAP_OFFSETS[action] ?? SINGLE_TAP;
}

/** 这个动作最后一下相对事件拍位置的偏移（拍） */
export function lastTapOffset(action: ActionType): number {
  return actionTapOffsets(action).at(-1)!;
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}
