// What the title menu and the Load Game list show for the save slots (doc/save-slots.md#title-screen).
// No DOM here; save-windows.ts draws it.

import type { SaveData } from '@/game/save-progress.ts';
import { formatSaveDate, type SaveSlots } from '@/game/save-slots.ts';

export type TitleItem = 'continue' | 'load' | 'new';

export interface TitleMenuState {
  /** The current save's name for "Continue: name"; null hides Continue */
  continueName: string | null;
  loadEnabled: boolean;
  newEnabled: boolean;
  /** What Enter or Space picks: the first item shown and enabled */
  defaultItem: TitleItem;
}

export const SLOTS_FULL_NOTE = 'All three save slots are in use. Delete one in Load Game first.';

export function titleMenuState(saves: SaveSlots): TitleMenuState {
  const continueName = saves.current?.name ?? null;
  const loadEnabled = saves.hasSaves;
  const newEnabled = saves.firstEmptySlot !== null;
  let defaultItem: TitleItem = 'load';
  if (newEnabled) defaultItem = 'new';
  if (continueName !== null) defaultItem = 'continue';
  return { continueName, loadEnabled, newEnabled, defaultItem };
}

/** How many of the device's levels a save has finished */
export interface FinishedLevels {
  finished: number;
  total: number;
}

/** The finished charts still among the levels on this device, out of all of them */
export function countFinished(
  save: Readonly<SaveData>,
  levelIds: readonly string[],
): FinishedLevels {
  const ids = new Set(levelIds);
  return { finished: save.finished.filter((id) => ids.has(id)).length, total: ids.size };
}

/** The two lines under a save's name in Load Game */
export function slotDetails(save: Readonly<SaveData>, levels: FinishedLevels): [string, string] {
  const noun = levels.total === 1 ? 'level' : 'levels';
  return [
    `Finished ${levels.finished} of ${levels.total} ${noun}`,
    `Last played ${formatSaveDate(save.lastPlayed)}`,
  ];
}
