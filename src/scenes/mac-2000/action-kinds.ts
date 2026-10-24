// Mac actions: action ID → widget kind and call cue (doc/scenes/mac-2000.md "Gameplay", "Sounds").
// No PixiJS, so chart validation and tests can use it.

import type { ActionType } from '@/rhythm/actions.ts';

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
 * Widget kinds: alert, Dock bounce, new mail, document window, Apple menu, file for the Trash,
 * window with a save sheet, iChat message, menu bar volume
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

/** File names under assets/reference/mac-os-x/sounds/ (without .aiff) */
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
  /** Cue on the call beat. Original alerts all share one sound; each kind gets its own here (provisional) */
  sound: MacSoundName;
  /**
   * Sound of each response press when hit, by press; Tink when omitted.
   * Two-press actions also book their later presses on the call beats from here (the first uses `sound`).
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
  // Click the Apple to drop the menu, then an item (both silent in the original; provisional)
  'menu-apple': { kind: 'menu', sound: 'Morse', handled: ['Morse', 'Tink'] },
  // A file lands, then goes in the Trash (the original crumple sound isn't available; provisional)
  'dock-trash': { kind: 'file', sound: 'Purr', handled: ['Blow'] },
  // Click close so the sheet slides out, then "Don't Save" (both silent in the original; provisional)
  'sheet-save': { kind: 'sheet', sound: 'Frog', handled: ['Frog', 'Tink'] },
  // iChat's own new-message sound isn't available (provisional)
  'ichat-message': { kind: 'chat', sound: 'Submarine' },
  // Grab the slider, then release (the original plays a beep at the new volume; provisional)
  'menu-volume': { kind: 'volume', sound: 'Tink', handled: ['Tink', 'Pop'] },
};

export const MAC_ACTION_TYPES = Object.keys(MAC_ACTIONS) as MacAction[];

export function isMacAction(action: string): action is MacAction {
  return Object.hasOwn(MAC_ACTIONS, action);
}

/** Sound of an action's step-th press when hit */
export function macHandledSound(action: MacAction, step: number): MacSoundName {
  return MAC_ACTIONS[action].handled?.[step] ?? 'Tink';
}

/** Alerts plus document windows that fit on screen at once (per phrase) */
export const MAX_WINDOWS_PER_PHRASE = 6;
/** Dock programs available to bounce (per phrase) */
export const MAX_BOUNCES_PER_PHRASE = 8;
/** Files that fit in the row above the Dock (per phrase) */
export const MAX_FILES_PER_PHRASE = 6;
/** iChat message windows that stack above the iChat icon (per phrase) */
export const MAX_CHATS_PER_PHRASE = 3;

/** Widget kinds that take one of the 6 window slots on screen */
export function usesWindowSlot(kind: MacTargetKind): boolean {
  return kind === 'alert' || kind === 'window' || kind === 'sheet';
}
