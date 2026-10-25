import { describe, expect, it } from 'vite-plus/test';
import { MAIL_UNLOCK_CHARTS } from './mailbox.ts';
import { cleanSaveName, emptySave, SaveProgress } from './save-progress.ts';

function progress(today = '2026-10-25') {
  const data = emptySave('Ivan', '2026-01-01', 'normal');
  let changes = 0;
  const save = new SaveProgress(
    data,
    () => changes++,
    () => today,
  );
  return { save, data, changes: () => changes };
}

describe('cleanSaveName', () => {
  it('trims and accepts 1 to 16 characters', () => {
    expect(cleanSaveName('  Ivan ')).toBe('Ivan');
    expect(cleanSaveName('   ')).toBeNull();
    expect(cleanSaveName('x'.repeat(16))).toBe('x'.repeat(16));
    expect(cleanSaveName('x'.repeat(17))).toBeNull();
  });
});

describe('SaveProgress', () => {
  it('keeps only better scores above 0, with the beat guide flag and the difficulty', () => {
    const { save, changes } = progress();
    const normal = (score: number, assisted: boolean) =>
      ({ score, assisted, difficulty: 'normal' }) as const;
    expect(save.recordScore('a', normal(0, false))).toBe(false);
    expect(save.recordScore('a', normal(500, true))).toBe(true);
    expect(save.best('a')?.assisted).toBe(true);
    expect(save.recordScore('a', normal(500, false))).toBe(false);
    expect(save.recordScore('a', { score: 700, assisted: false, difficulty: 'hell' })).toBe(true);
    expect(save.best('a')).toEqual({ score: 700, assisted: false, difficulty: 'hell' });
    expect(save.bestScore('a')).toBe(700);
    expect(save.best('b')).toBeNull();
    expect(save.bestScore('b')).toBeNull();
    expect(changes()).toBe(2);
  });

  it('changes the difficulty, saving only real changes', () => {
    const { save, changes } = progress();
    expect(save.difficulty).toBe('normal');
    save.setDifficulty('normal');
    save.setDifficulty('hard');
    expect(save.difficulty).toBe('hard');
    expect(changes()).toBe(1);
  });

  it('counts each finished chart once and dates the save', () => {
    const { save, data } = progress('2026-10-26');
    save.recordFinished('a');
    save.recordFinished('a');
    expect(save.finished).toEqual(['a']);
    expect(data.lastPlayed).toBe('2026-10-26');
  });

  it('delivers the Rickroll message after enough charts and remembers it was read', () => {
    const { save } = progress();
    save.markMailRead();
    expect(save.mailState).toBe('empty');
    for (let i = 0; i < MAIL_UNLOCK_CHARTS; i++) save.recordFinished(`chart-${i}`);
    expect(save.mailState).toBe('unread');
    save.markMailRead();
    expect(save.mailState).toBe('read');
  });

  it('remembers the booklet', () => {
    const { save, changes } = progress();
    expect(save.bookletRead).toBe(false);
    save.markBookletRead();
    save.markBookletRead();
    expect(save.bookletRead).toBe(true);
    expect(changes()).toBe(1);
  });
});
