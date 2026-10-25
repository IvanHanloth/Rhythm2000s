import { describe, expect, it, vi } from 'vite-plus/test';
import {
  formatSaveDate,
  parseSaveFile,
  SAVES_KEY,
  SaveSlots,
  todayString,
  UNREADABLE_KEY,
} from './save-slots.ts';
import { brokenStorage, memoryStorage } from './test-storage.ts';

const today = () => '2026-10-25';

describe('dates', () => {
  it('writes the local date and shows it in English', () => {
    expect(todayString(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(formatSaveDate('2026-10-05')).toBe('5 Oct 2026');
    expect(formatSaveDate('2001-01-31')).toBe('31 Jan 2001');
    expect(() => formatSaveDate('yesterday')).toThrow();
  });
});

describe('SaveSlots', () => {
  it('starts with three empty slots and no current save', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    expect(saves.hasSaves).toBe(false);
    expect(saves.current).toBeNull();
    expect(saves.firstEmptySlot).toBe(1);
    expect(() => saves.requireCurrent()).toThrow();
  });

  it('creates, loads, renames and deletes saves, kept across visits', () => {
    const storage = memoryStorage();
    const saves = new SaveSlots(storage, today);
    const ivan = saves.create(1, ' Ivan ', 'normal');
    expect(ivan.name).toBe('Ivan');
    ivan.recordScore('xp-dial-up', { score: 800, assisted: false, difficulty: 'normal' });
    saves.create(2, 'Guest', 'normal');
    expect(saves.currentSlot).toBe(2);
    expect(saves.firstEmptySlot).toBe(3);

    const again = new SaveSlots(storage, today);
    expect(again.currentSlot).toBe(2);
    expect(again.load(1).bestScore('xp-dial-up')).toBe(800);
    expect(again.current?.name).toBe('Ivan');
    again.rename(1, 'Ivan H');
    expect(again.slot(1)?.name).toBe('Ivan H');

    again.delete(1);
    expect(again.current).toBeNull();
    expect(again.slot(1)).toBeNull();
    expect(new SaveSlots(storage, today).currentSlot).toBeNull();
    expect(again.firstEmptySlot).toBe(1);
  });

  it('refuses bad names and slots that are taken or empty', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    expect(() => saves.create(1, '  ', 'normal')).toThrow();
    saves.create(1, 'Ivan', 'normal');
    expect(() => saves.create(1, 'Again', 'normal')).toThrow();
    expect(() => saves.load(2)).toThrow();
    expect(() => saves.rename(1, 'x'.repeat(17))).toThrow();
    expect(() => saves.delete(3)).toThrow();
  });

  it('keeps the difficulty of each save, set in New Game and changed later', () => {
    const storage = memoryStorage();
    const saves = new SaveSlots(storage, today);
    saves.create(1, 'Ivan', 'hell');
    saves.create(2, 'Guest', 'easy').setDifficulty('heaven');
    const again = new SaveSlots(storage, today);
    expect(again.slot(1)?.difficulty).toBe('hell');
    expect(again.requireCurrent().difficulty).toBe('heaven');
  });

  it('reports full slots', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    for (const slot of [1, 2, 3] as const) saves.create(slot, `Save ${slot}`, 'normal');
    expect(saves.firstEmptySlot).toBeNull();
  });

  it('dates a save when it is loaded', () => {
    const storage = memoryStorage();
    new SaveSlots(storage, () => '2026-01-01').create(1, 'Ivan', 'normal');
    const later = new SaveSlots(storage, today);
    expect(later.slot(1)?.lastPlayed).toBe('2026-01-01');
    later.load(1);
    expect(later.slot(1)?.lastPlayed).toBe('2026-10-25');
  });

  it('tells listeners about every change', () => {
    const saves = new SaveSlots(memoryStorage(), today);
    let calls = 0;
    const stop = saves.onChange(() => calls++);
    saves.create(1, 'Ivan', 'normal').markBookletRead();
    stop();
    saves.rename(1, 'Other');
    expect(calls).toBe(2);
  });

  it('keeps working in memory when storage is blocked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const saves = new SaveSlots(brokenStorage(), today);
    saves.create(1, 'Ivan', 'normal').markBookletRead();
    expect(saves.current?.bookletRead).toBe(true);
    expect(new SaveSlots(null, today).hasSaves).toBe(false);
    warn.mockRestore();
  });

  it('keeps an unreadable entry aside and starts empty', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = memoryStorage({ [SAVES_KEY]: '{"version": 99}' });
    const saves = new SaveSlots(storage, today);
    expect(saves.hasSaves).toBe(false);
    expect(storage.data.get(UNREADABLE_KEY)).toBe('{"version": 99}');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('moving older progress into slot 1', () => {
  it('moves best scores, finished charts, the message and the booklet, then removes the old entries', () => {
    const storage = memoryStorage({
      'rhythm2000s.best.xp-dial-up': '812',
      'rhythm2000s.bestAssist.xp-dial-up': '1',
      'rhythm2000s.best.mac-beach-ball': '640',
      'rhythm2000s.finishedCharts': '["xp-dial-up","mac-beach-ball","xp-blue-screen"]',
      'rhythm2000s.rickrollMailRead': '1',
      'rhythm2000s.guideBookletRead': '1',
      'rhythm2000s.calibrationMs': '25',
      'rhythm2000s.importedCharts': '[]',
    });
    const saves = new SaveSlots(storage, today);
    expect(saves.currentSlot).toBe(1);
    const save = saves.requireCurrent();
    expect(save.name).toBe('Save 1');
    expect(save.bestScore('xp-dial-up')).toBe(812);
    expect(save.best('xp-dial-up')).toEqual({ score: 812, assisted: true, difficulty: 'normal' });
    expect(save.bestScore('mac-beach-ball')).toBe(640);
    expect(save.best('mac-beach-ball')?.assisted).toBe(false);
    expect(save.difficulty).toBe('normal');
    expect(save.finished).toHaveLength(3);
    expect(save.mailState).toBe('read');
    expect(save.bookletRead).toBe(true);
    expect(saves.slot(1)?.lastPlayed).toBe('2026-10-25');

    // Settings and imported charts belong to the device and stay put
    expect([...storage.data.keys()].sort()).toEqual([
      'rhythm2000s.calibrationMs',
      'rhythm2000s.importedCharts',
      SAVES_KEY,
    ]);
    expect(new SaveSlots(storage, today).requireCurrent().bestScore('xp-dial-up')).toBe(812);
  });

  it('creates nothing for a new player', () => {
    const storage = memoryStorage({ 'rhythm2000s.beatGuide': '1' });
    const saves = new SaveSlots(storage, today);
    expect(saves.hasSaves).toBe(false);
    expect(storage.data.has(SAVES_KEY)).toBe(false);
  });

  it('runs only once', () => {
    const storage = memoryStorage({ 'rhythm2000s.guideBookletRead': '1' });
    new SaveSlots(storage, today).delete(1);
    storage.setItem('rhythm2000s.best.late', '100');
    expect(new SaveSlots(storage, today).hasSaves).toBe(false);
  });
});

describe('parseSaveFile', () => {
  const save = {
    name: 'Ivan',
    lastPlayed: '2026-10-25',
    difficulty: 'hard',
    best: { a: { score: 1, assisted: false, difficulty: 'hell' } },
    finished: ['a'],
    rickrollMailRead: false,
    bookletRead: true,
  };

  it('reads a valid file and drops a current slot that is empty', () => {
    const file = parseSaveFile(
      JSON.stringify({ version: 2, current: 2, slots: [save, null, null] }),
    );
    expect(file.slots[0]?.name).toBe('Ivan');
    expect(file.slots[0]?.difficulty).toBe('hard');
    expect(file.slots[0]?.best.a?.difficulty).toBe('hell');
    expect(file.current).toBeNull();
  });

  it('reads a version 1 file as Normal throughout', () => {
    const old = { ...save, difficulty: undefined, best: { a: { score: 1, assisted: true } } };
    const file = parseSaveFile(
      JSON.stringify({ version: 1, current: 1, slots: [old, null, null] }),
    );
    expect(file.version).toBe(2);
    expect(file.slots[0]?.difficulty).toBe('normal');
    expect(file.slots[0]?.best.a).toEqual({ score: 1, assisted: true, difficulty: 'normal' });
  });

  it('rejects broken files', () => {
    const file = (changes: object) =>
      JSON.stringify({ version: 2, current: 1, slots: [save, null, null], ...changes });
    expect(() => parseSaveFile('not json')).toThrow();
    expect(() => parseSaveFile(file({ slots: [save] }))).toThrow();
    expect(() => parseSaveFile(file({ current: 4 }))).toThrow();
    expect(() => parseSaveFile(file({ slots: [{ ...save, name: '' }, null, null] }))).toThrow();
    expect(() =>
      parseSaveFile(file({ slots: [{ ...save, best: { a: { score: 'x' } } }, null, null] })),
    ).toThrow();
    expect(() =>
      parseSaveFile(file({ slots: [{ ...save, lastPlayed: 'today' }, null, null] })),
    ).toThrow();
    expect(() =>
      parseSaveFile(file({ slots: [{ ...save, difficulty: 'nightmare' }, null, null] })),
    ).toThrow();
    expect(() =>
      parseSaveFile(
        file({ slots: [{ ...save, best: { a: { score: 1, assisted: false } } }, null, null] }),
      ),
    ).toThrow();
  });
});
