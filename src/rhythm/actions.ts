// 动作 ID：示范段出现的界面部件，按原版系统的类名或常量名取名（doc/chart-format.md、ADR 0005）。
// 写成「部件-变体」，例如 XP 消息框的 MB_ICONINFORMATION → dialog-info。
// 玩家在跟打段要对它做什么由部件决定；每个场景声明自己支持哪些动作。

export const ACTION_TYPES = [
  'dialog-info',
  'dialog-warning',
  'dialog-error',
  'dialog-question',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  'dialog-info': '信息消息框',
  'dialog-warning': '警告消息框',
  'dialog-error': '错误消息框',
  'dialog-question': '询问消息框',
};

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}
