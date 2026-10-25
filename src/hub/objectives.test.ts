import { describe, expect, it } from 'vite-plus/test';
import { BookletProgress, currentObjective, type ObjectiveStorage } from './objectives.ts';

function memoryStorage(): ObjectiveStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('currentObjective', () => {
  it('asks for the booklet first, then a song, then nothing', () => {
    expect(currentObjective(false, false)).toBe('booklet');
    expect(currentObjective(false, true)).toBe('booklet');
    expect(currentObjective(true, false)).toBe('play');
    expect(currentObjective(true, true)).toBeNull();
  });
});

describe('BookletProgress', () => {
  it('remembers the booklet across visits', () => {
    const storage = memoryStorage();
    const first = new BookletProgress(storage);
    expect(first.read).toBe(false);
    first.markRead();
    expect(new BookletProgress(storage).read).toBe(true);
  });

  it('counts the booklet as read for this visit when storage fails', () => {
    const broken: ObjectiveStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const progress = new BookletProgress(broken);
    progress.markRead();
    expect(progress.read).toBe(true);
    expect(new BookletProgress(null).read).toBe(false);
  });
});
