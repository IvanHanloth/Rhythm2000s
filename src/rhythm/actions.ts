// Action IDs: the UI widget shown in the call, named after the original OS class or constant (doc/chart-format.md, ADR 0006).
// Written as `widget-variant`, e.g. XP's MB_ICONINFORMATION → dialog-info, Mac's kAlertNoteAlert → alert-note.
// What the player does to it in the response is up to the widget; each scene declares which actions it supports.

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
  'alert-note',
  'alert-caution',
  'alert-stop',
  'dock-bounce',
  'mail-new',
  'window-miniaturize',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  'dialog-info': 'Information box',
  'dialog-warning': 'Warning box',
  'dialog-error': 'Error box',
  'dialog-question': 'Question box',
  'desktop-refresh': 'Right-click refresh',
  'balloon-info': 'Tray balloon',
  'window-minimize': 'Minimise window',
  'start-menu': 'Start menu',
  'recycle-bin': 'Drag to Recycle Bin',
  'alert-note': 'Mac note alert',
  'alert-caution': 'Mac caution alert',
  'alert-stop': 'Mac stop alert',
  'dock-bounce': 'Dock icon bounce',
  'mail-new': 'New mail',
  'window-miniaturize': 'Minimise to Dock',
};

/**
 * How many presses an action takes: each press's offset (in beats) from the event's beat. Most actions take one ([0]);
 * desktop-refresh is right-click, then "Refresh" half a beat later (doc/chart-format.md, fixed interval set by the user on 2026-10-24);
 * start-menu is "start", then a menu item half a beat later (doc/scenes/windows-xp-levels.md).
 */
const TAP_OFFSETS: Partial<Record<ActionType, readonly number[]>> = {
  'desktop-refresh': [0, 0.5],
  'start-menu': [0, 0.5],
};
const SINGLE_TAP: readonly number[] = [0];

export function actionTapOffsets(action: ActionType): readonly number[] {
  return TAP_OFFSETS[action] ?? SINGLE_TAP;
}

/** Offset (beats) of the action's last press from the event's beat */
export function lastTapOffset(action: ActionType): number {
  return actionTapOffsets(action).at(-1)!;
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (ACTION_TYPES as readonly string[]).includes(value);
}
