// 动作 ID：示范段出现的界面部件，按原版系统的类名或常量名取名（doc/chart-format.md、ADR 0005）。
// 写成「部件-变体」，例如 XP 消息框的 MB_ICONINFORMATION → dialog-info，Mac 的 kAlertNoteAlert → alert-note。
// 玩家在跟打段要对它做什么由部件决定；每个场景声明自己支持哪些动作。

export const ACTION_TYPES = [
  'dialog-info',
  'dialog-warning',
  'dialog-error',
  'dialog-question',
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
  'alert-note': 'Mac 提示框',
  'alert-caution': 'Mac 警告提示框',
  'alert-stop': 'Mac 停止提示框',
  'dock-bounce': 'Dock 图标弹跳',
  'mail-new': '新邮件',
  'window-miniaturize': '最小化窗口',
};

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}
