import { describe, expect, it } from 'vite-plus/test';
import { emptySave } from '@/game/save-progress.ts';
import { parseSaveFile, SAVES_KEY, SaveSlots } from '@/game/save-slots.ts';
import { memoryStorage } from '@/game/test-storage.ts';
import { countFinished, slotDetails, titleMenuState } from './save-menu.ts';

const today = () => '2026-10-25';

describe('titleMenuState', () => {
  it('offers only New Game to a new player', () => {
    expect(titleMenuState(new SaveSlots(memoryStorage(), today))).toEqual({
      continueName: null,
      loadEnabled: false,
      newEnabled: true,
      defaultItem: 'new',
    });
  });

  it('continues the current save', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    saves.create(1, 'Ivan');
    expect(titleMenuState(saves)).toMatchObject({
      continueName: 'Ivan',
      loadEnabled: true,
      defaultItem: 'continue',
    });
  });

  it('disables New Game when full, and drops Continue when the current save is deleted', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    for (const slot of [1, 2, 3] as const) saves.create(slot, `Save ${slot}`);
    expect(titleMenuState(saves)).toMatchObject({ newEnabled: false, defaultItem: 'continue' });
    saves.delete(3);
    expect(titleMenuState(saves)).toMatchObject({
      continueName: null,
      newEnabled: true,
      defaultItem: 'new',
    });
  });

  it('picks Load Game when all slots are full and none is current', () => {
    const storage = memoryStorage();
    const saves = new SaveSlots(storage, today);
    for (const slot of [1, 2, 3] as const) saves.create(slot, `Save ${slot}`);
    const file = parseSaveFile(storage.data.get(SAVES_KEY) ?? '');
    storage.setItem(SAVES_KEY, JSON.stringify({ ...file, current: null }));
    expect(titleMenuState(new SaveSlots(storage, today))).toMatchObject({
      continueName: null,
      newEnabled: false,
      defaultItem: 'load',
    });
  });
});

describe('Load Game lines', () => {
  it('counts only finished charts still on this device', () => {
    const save = { ...emptySave('Ivan', '2026-10-25'), finished: ['a', 'gone', 'b'] };
    const levels = countFinished(save, ['a', 'b', 'c', 'd']);
    expect(levels).toEqual({ finished: 2, total: 4 });
    expect(slotDetails(save, levels)).toEqual([
      'Finished 2 of 4 levels',
      'Last played 25 Oct 2026',
    ]);
  });
});
