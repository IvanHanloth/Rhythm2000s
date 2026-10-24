import { describe, expect, it } from 'vite-plus/test';
import { arrangeMachines, type Seat } from './cafe-layout.ts';

const level = (id: string, sceneId: string) => ({ id, sceneId });
const ids = (row: Seat<{ id: string }>[]) =>
  row.map((s) => (s.kind === 'level' ? s.level.id : s.kind));

describe('arrangeMachines', () => {
  it('每个场景从新的一排开始，空位轮流放点缀', () => {
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

  it('排不满时下一个场景跳到下一排', () => {
    const { seats } = arrangeMachines([level('x1', 'xp'), level('m1', 'mac')], 2, 4);
    expect(seats.map(ids)).toEqual([
      ['x1', 'repair', 'busy', 'off'],
      ['m1', 'repair', 'busy', 'off'],
    ]);
  });

  it('坐不下的关卡放进 overflow', () => {
    const { overflow } = arrangeMachines(
      [level('a', 'xp'), level('b', 'xp'), level('c', 'xp')],
      1,
      2,
    );
    expect(overflow.map((l) => l.id)).toEqual(['c']);
  });
});
