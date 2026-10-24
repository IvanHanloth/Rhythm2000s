// 虚拟鼠标的移动轨迹（doc/scenes/windows-xp.md「虚拟鼠标」）。
// 轨迹由一串「停靠点」决定：在某一拍要停在某个位置。位置只由拍算出来，跟着音频时钟走，不累加帧间隔。
// 不依赖 PixiJS，便于测试。

export interface CursorStop {
  /** 要在这一拍停在这里（全曲拍） */
  beat: number;
  x: number;
  y: number;
  /** 最早什么时候离开（拍）；不写时拍点后 holdBeats 离开 */
  leave?: number;
}

export interface CursorPathOptions {
  /** 提前多少拍到位 */
  leadBeats: number;
  /** 示范段点完以后停多久再走（拍） */
  holdBeats?: number;
  /** 两个停靠点之间最多用多久移过去（拍） */
  maxMoveBeats?: number;
  /** 时间不够时，最少也要用这么久移过去（拍），免得瞬移 */
  minMoveBeats?: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 慢进慢出 */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * 虚拟鼠标在某一拍的位置。stops 按 beat 从小到大排列，至少一个。
 * 第一个停靠点之前停在第一个停靠点上；最后一个之后停在最后一个上。
 */
export function cursorAt(
  stops: readonly CursorStop[],
  beat: number,
  options: CursorPathOptions,
): Point {
  const { leadBeats, holdBeats = 1 / 16, maxMoveBeats = 0.5, minMoveBeats = 1 / 16 } = options;
  const first = stops[0];
  if (!first) throw new Error('虚拟鼠标至少要有一个停靠点');

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!;
    const to = stops[i]!;
    const leave = from.leave ?? from.beat + holdBeats;
    let end = to.beat - leadBeats;
    let start = Math.max(leave, end - maxMoveBeats);
    if (end - start < minMoveBeats) {
      start = leave;
      end = leave + minMoveBeats;
    }
    if (beat < start) return { x: from.x, y: from.y };
    if (beat < end) {
      const t = easeInOut((beat - start) / (end - start));
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
  }
  const last = stops.at(-1)!;
  return { x: last.x, y: last.y };
}
