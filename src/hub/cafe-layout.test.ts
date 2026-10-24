import { describe, expect, it } from 'vite-plus/test';
import { arrangeMachines, type Seat } from './cafe-layout.ts';

const machine = (id: string, row: number) => ({ id, row });
const ids = (row: Seat<{ id: string }>[]) =>
  row.map((s) => (s.kind === 'level' ? s.level.id : s.kind));

describe('arrangeMachines', () => {
  it('seats each row side by side from the first seat, so editors sit behind their play computers', () => {
    const { seats, overflow } = arrangeMachines(
      [machine('xp', 0), machine('mac', 0), machine('xp-editor', 1), machine('mac-editor', 1)],
      3,
      4,
    );
    expect(seats.map(ids)).toEqual([
      ['xp', 'mac', 'busy', 'off'],
      ['xp-editor', 'mac-editor', 'busy', 'off'],
      ['busy', 'repair', 'busy', 'off'],
    ]);
    expect(overflow).toEqual([]);
  });

  it('puts machines that do not fit their row into overflow', () => {
    const { overflow } = arrangeMachines(
      [machine('a', 0), machine('b', 0), machine('c', 0), machine('d', 5)],
      1,
      2,
    );
    expect(overflow.map((l) => l.id)).toEqual(['c', 'd']);
  });
});
