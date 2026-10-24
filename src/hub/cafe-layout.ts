// Seating in the net café: each entry computer sits in its row (the play computers in the front row, the chart
// editors in the row behind), side by side from the first seat in order, so each editor sits behind its scene's
// play computer; empty seats take turns showing an occupied, out-of-order or switched-off machine as decoration.
// No three.js, so unit tests can use it.

export type Filler = 'busy' | 'repair' | 'off';

/** Decoration for empty seats, in seat order */
const FILLERS: readonly Filler[] = ['busy', 'repair', 'busy', 'off'];

export type Seat<T> = { kind: 'level'; level: T } | { kind: Filler };

export interface CafeLayout<T> {
  /** rows × columns seats, by row then column */
  seats: Seat<T>[][];
  /** Levels that don't fit */
  overflow: T[];
}

export function arrangeMachines<T extends { row: number }>(
  levels: readonly T[],
  rows: number,
  columns: number,
): CafeLayout<T> {
  const placed: (T | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );
  const overflow: T[] = [];
  for (const level of levels) {
    const row = placed[level.row];
    const column = row?.indexOf(null) ?? -1;
    if (!row || column < 0) overflow.push(level);
    else row[column] = level;
  }
  const seats = placed.map((row, r) =>
    row.map((level, col): Seat<T> => {
      if (level) return { kind: 'level', level };
      return { kind: FILLERS[(r * columns + col) % FILLERS.length]! };
    }),
  );
  return { seats, overflow };
}
