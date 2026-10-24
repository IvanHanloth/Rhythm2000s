// 动作 ID：描述玩家要做的事，各场景共用一套名字（doc/chart-format.md）。
// 示范段怎么演由场景决定；每个场景声明自己支持哪些动作。

export const ACTION_TYPES = ['close-window'] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  'close-window': '关闭窗口',
};

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}
