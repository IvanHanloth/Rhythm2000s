// Seating in the net café: one entry computer per scene, each scene starting a new row (XP and Mac sit apart);
// empty seats take turns showing an occupied, out-of-order or switched-off machine as decoration.
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

export function arrangeMachines<T extends { sceneId: string }>(
  levels: readonly T[],
  rows: number,
  columns: number,
): CafeLayout<T> {
  const slots: (T | null)[] = Array.from({ length: rows * columns }, () => null);
  const overflow: T[] = [];
  let cursor = 0;
  let lastScene: string | null = null;
  for (const level of levels) {
    // A new scene starts a new row
    if (level.sceneId !== lastScene && cursor % columns !== 0)
      cursor += columns - (cursor % columns);
    lastScene = level.sceneId;
    if (cursor >= slots.length) {
      overflow.push(level);
      continue;
    }
    slots[cursor++] = level;
  }
  const seats = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col): Seat<T> => {
      const index = row * columns + col;
      const level = slots[index];
      return level ? { kind: 'level', level } : { kind: FILLERS[index % FILLERS.length]! };
    }),
  );
  return { seats, overflow };
}
