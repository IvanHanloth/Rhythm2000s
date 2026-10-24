// XP's system icons (doc/chart-format.md "Icon IDs"): every PNG in assets/reference/windows-xp/icons/, by file name.
// A chart can take any of them as its level icon. No PixiJS, so the scene catalog and unit tests can use it.

import type { ActionType } from '@/rhythm/actions.ts';
import { DIALOG_KINDS, isDialogKind } from './dialog-kinds.ts';

/** Icon file name (without .png) → URL */
export const XP_ICON_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('/assets/reference/windows-xp/icons/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.replace(/^.*\/(.+)\.png$/, '$1'), url]),
);

/** Every icon ID, alphabetical */
export const XP_ICON_IDS: readonly string[] = Object.keys(XP_ICON_URLS).sort();

/**
 * The level icon of a chart that sets none (doc/level-select.md): the message box icon when it uses one kind,
 * a program window for anything else.
 */
export function autoXpIcon(actions: readonly ActionType[]): string {
  const only = actions.length === 1 ? actions[0]! : null;
  return only && isDialogKind(only) ? DIALOG_KINDS[only].icon : 'program-window';
}
