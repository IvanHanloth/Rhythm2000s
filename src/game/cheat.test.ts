import { describe, expect, it } from 'vite-plus/test';
import { CheatCodeReader, CheatMode } from './cheat.ts';

function typeAll(reader: CheatCodeReader, text: string): boolean[] {
  return text.split('').map((char) => reader.push(char));
}

describe('CheatCodeReader', () => {
  it('completes on the last letter of the code, ignoring case', () => {
    const results = typeAll(new CheatCodeReader(), 'IvanHanloth');
    expect(results.at(-1)).toBe(true);
    expect(results.slice(0, -1).every((done) => !done)).toBe(true);
  });

  it('finds the code after other typing', () => {
    expect(typeAll(new CheatCodeReader(), 'wasdIVANHANLOTH').at(-1)).toBe(true);
  });

  it('starts again after a stray character', () => {
    expect(typeAll(new CheatCodeReader(), 'Ivan Hanloth').at(-1)).toBe(false);
  });

  it('needs the whole code again after completing', () => {
    const reader = new CheatCodeReader();
    typeAll(reader, 'ivanhanloth');
    expect(reader.push('h')).toBe(false);
    expect(typeAll(reader, 'ivanhanloth').at(-1)).toBe(true);
  });
});

describe('CheatMode', () => {
  it('turns on once and off with the coin', () => {
    const cheat = new CheatMode();
    const changes: boolean[] = [];
    cheat.onChange((active) => changes.push(active));
    expect(cheat.insertCoin()).toBe(false);
    expect(cheat.activate()).toBe(true);
    expect(cheat.activate()).toBe(false);
    expect(cheat.active).toBe(true);
    expect(cheat.insertCoin()).toBe(true);
    expect(cheat.active).toBe(false);
    expect(changes).toEqual([true, false]);
  });
});
