// 网吧机位分配：每个场景一台入口电脑，每个场景从新的一排开始（XP、Mac 分开坐），
// 空着的位子轮流放「有人占着」「维修中」「没开机」的机器做点缀。
// 不依赖 three，单元测试可以直接用。

export type Filler = 'busy' | 'repair' | 'off';

/** 空位的点缀，按位子顺序轮流 */
const FILLERS: readonly Filler[] = ['busy', 'repair', 'busy', 'off'];

export type Seat<T> = { kind: 'level'; level: T } | { kind: Filler };

export interface CafeLayout<T> {
  /** rows × columns 的机位，按排、按列 */
  seats: Seat<T>[][];
  /** 坐不下的关卡 */
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
    // 换场景时另起一排
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
