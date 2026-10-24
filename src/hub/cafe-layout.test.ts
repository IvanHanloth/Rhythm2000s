import { describe, expect, it } from 'vite-plus/test';
import { arrangeMachines, type Seat } from './cafe-layout.ts';

const level = (id: string, sceneId: string) => ({ id, sceneId });
const ids = (row: Seat<{ id: string }>[]) =>
  row.map((s) => (s.kind === 'level' ? s.level.id : s.kind));

describe('arrangeMachines', () => {
  it('starts each scene on a new row and fills empty seats with props in turn', () => {
    const { seats, overflow } = arrangeMachines(
      [
        level('x1', 'xp'),
        level('x2', 'xp'),
        level('m1', 'mac'),
        level('m2', 'mac'),
        level('m3', 'mac'),
      ],
      3,
      2,
    );
    expect(seats.map(ids)).toEqual([
      ['x1', 'x2'],
      ['m1', 'm2'],
      ['m3', 'repair'],
    ]);
    expect(overflow).toEqual([]);
  });

  it('moves the next scene to the next row when a row is not full', () => {
    const { seats } = arrangeMachines([level('x1', 'xp'), level('m1', 'mac')], 2, 4);
    expect(seats.map(ids)).toEqual([
      ['x1', 'repair', 'busy', 'off'],
      ['m1', 'repair', 'busy', 'off'],
    ]);
  });

  it('puts levels that do not fit into overflow', () => {
    const { overflow } = arrangeMachines(
      [level('a', 'xp'), level('b', 'xp'), level('c', 'xp')],
      1,
      2,
    );
    expect(overflow.map((l) => l.id)).toEqual(['c']);
  });
});
