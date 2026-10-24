// The Mac scene's system icons (doc/chart-format.md "Icon IDs"): the application icons in
// assets/reference/mac-os-x/icons/ and the icons the scene draws. A chart can take any of them as its level icon.
// No PixiJS, so the scene catalog and unit tests can use it; components/system-icon.ts draws them.

import type { ActionType } from '@/rhythm/actions.ts';
import { isMacAction, MAC_ACTIONS, type MacTargetKind } from './action-kinds.ts';
import type { AppIconName } from './assets.ts';

/** Icons drawn as vectors (src/scenes/mac-2000/components/) rather than read from a file */
export type DrawnMacIcon =
  | 'finder'
  | 'folder'
  | 'document'
  | 'trash'
  | 'trash-full'
  | 'caution'
  | 'apple'
  | 'speaker';

export type MacIconSource = { app: AppIconName } | { drawn: DrawnMacIcon };

/** Icon ID → where it comes from, in chooser order. Dashboard.png is left out: Dashboard is 10.4, after the scene's 10.0–10.2 */
export const MAC_ICONS = {
  'address-book': { app: 'AddressBook' },
  calculator: { app: 'Calculator' },
  chess: { app: 'Chess' },
  'dvd-player': { app: 'DVD Player' },
  ical: { app: 'iCal' },
  ichat: { app: 'iChat' },
  iphoto: { app: 'iPhoto' },
  itunes: { app: 'iTunes' },
  mail: { app: 'Mail' },
  preview: { app: 'Preview' },
  'quicktime-player': { app: 'QuickTime Player' },
  safari: { app: 'Safari' },
  sherlock: { app: 'Sherlock' },
  stickies: { app: 'Stickies' },
  'system-preferences': { app: 'System Preferences' },
  terminal: { app: 'Terminal' },
  textedit: { app: 'TextEdit' },
  finder: { drawn: 'finder' },
  folder: { drawn: 'folder' },
  document: { drawn: 'document' },
  trash: { drawn: 'trash' },
  'trash-full': { drawn: 'trash-full' },
  caution: { drawn: 'caution' },
  apple: { drawn: 'apple' },
  speaker: { drawn: 'speaker' },
} as const satisfies Record<string, MacIconSource>;

export type MacIconId = keyof typeof MAC_ICONS;

export const MAC_ICON_IDS = Object.keys(MAC_ICONS) as readonly MacIconId[];

export function isMacIconId(id: string): id is MacIconId {
  return Object.hasOwn(MAC_ICONS, id);
}

/** Icon standing for each widget kind in the level list; levels mixing several use iTunes (a remix) */
const KIND_ICONS: Record<MacTargetKind, MacIconId> = {
  alert: 'caution',
  dock: 'ichat',
  mail: 'mail',
  window: 'textedit',
  menu: 'system-preferences',
  file: 'trash-full',
  sheet: 'textedit',
  chat: 'ichat',
  volume: 'itunes',
  // The cutaway is a little film of the café (provisional)
  chair: 'quicktime-player',
};

/** Widget kinds a chart's actions use, in order of first appearance */
export function macKinds(actions: readonly ActionType[]): MacTargetKind[] {
  return [...new Set(actions.filter(isMacAction).map((a) => MAC_ACTIONS[a].kind))];
}

/** The level icon of a chart that sets none (doc/level-select.md): its widget kind's icon, iTunes for a mix */
export function autoMacIcon(actions: readonly ActionType[]): MacIconId {
  const kinds = macKinds(actions);
  return kinds.length === 1 ? KIND_ICONS[kinds[0]!] : 'itunes';
}
