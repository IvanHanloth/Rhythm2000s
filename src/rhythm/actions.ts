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
  'progress-download',
  'volume-mute',
  'alert-note',
  'alert-caution',
  'alert-stop',
  'dock-bounce',
  'mail-new',
  'window-miniaturize',
  'menu-apple',
  'dock-trash',
  'sheet-save',
  'ichat-message',
  'menu-volume',
  'chair-swivel',
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
  'progress-download': 'File download',
  'volume-mute': 'Volume control',
  'alert-note': 'Mac note alert',
  'alert-caution': 'Mac caution alert',
  'alert-stop': 'Mac stop alert',
  'dock-bounce': 'Dock icon bounce',
  'mail-new': 'New mail',
  'window-miniaturize': 'Minimise to Dock',
  'menu-apple': 'Apple menu',
  'dock-trash': 'Trash',
  'sheet-save': 'Save sheet',
  'ichat-message': 'iChat message',
  'menu-volume': 'Volume menu',
  'chair-swivel': 'Swivel chair spin',
};

/** Length of chair-swivel's 3D cutaway (beats): from the press until the view is back in the monitor (provisional) */
export const CHAIR_SWIVEL_BEATS = 2;

/**
 * Offsets (beats) of each press from the event's beat; most actions take a single press ([0]).
 * Two-click actions (a click, then a menu item or button) follow half a beat apart; progress-download is
 * clicked when its bar fills 3 beats in; the volume actions are pressed on the beat and released 1 beat later
 * (doc/chart-format.md "Actions"). chair-swivel is pressed on the beat and lands by itself when the 3D
 * cutaway ends (doc/cross-dimension.md).
 */
const TAP_OFFSETS: Partial<Record<ActionType, readonly number[]>> = {
  'desktop-refresh': [0, 0.5],
  'start-menu': [0, 0.5],
  'menu-apple': [0, 0.5],
  'sheet-save': [0, 0.5],
  'progress-download': [3],
  'volume-mute': [0, 1],
  'menu-volume': [0, 1],
  'chair-swivel': [0, CHAIR_SWIVEL_BEATS],
};

/**
 * Whether the player makes a press or the game completes it after the previous press hits
 * (visuals and sound as normal, not judged or scored). volume-mute and menu-volume release by themselves;
 * chair-swivel lands by itself.
 */
export type TapKind = 'press' | 'auto';
const TAP_KINDS: Partial<Record<ActionType, readonly TapKind[]>> = {
  'volume-mute': ['press', 'auto'],
  'menu-volume': ['press', 'auto'],
  'chair-swivel': ['press', 'auto'],
};

export function actionTapKind(action: ActionType, step: number): TapKind {
  return TAP_KINDS[action]?.[step] ?? 'press';
}

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
