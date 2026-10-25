import { describe, expect, it } from 'vite-plus/test';
import { currentObjective } from './objectives.ts';

describe('currentObjective', () => {
  it('asks for the booklet first, then a song, then nothing', () => {
    expect(currentObjective(false, false)).toBe('booklet');
    expect(currentObjective(false, true)).toBe('booklet');
    expect(currentObjective(true, false)).toBe('play');
    expect(currentObjective(true, true)).toBeNull();
  });
});
