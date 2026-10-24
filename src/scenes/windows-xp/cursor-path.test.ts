import { describe, expect, it } from 'vite-plus/test';
import { cursorAt, type CursorStop } from './cursor-path.ts';

const options = { leadBeats: 0.25, holdBeats: 0.0625, maxMoveBeats: 0.5 };

describe('cursorAt', () => {
  const stops: CursorStop[] = [
    { beat: 0, x: 0, y: 0 },
    { beat: 2, x: 100, y: 50 },
  ];

  it('离目标还远时停在原地，最多提前半拍出发，提前 lead 拍到位', () => {
    expect(cursorAt(stops, 1.2, options)).toEqual({ x: 0, y: 0 });
    // 出发：2 - 0.25 - 0.5 = 1.25；到位：1.75
    expect(cursorAt(stops, 1.25, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(stops, 1.5, options)).toEqual({ x: 50, y: 25 });
    expect(cursorAt(stops, 1.75, options)).toEqual({ x: 100, y: 50 });
    expect(cursorAt(stops, 2.1, options)).toEqual({ x: 100, y: 50 });
  });

  it('第一个停靠点之前停在第一个点上', () => {
    expect(cursorAt(stops, -3, options)).toEqual({ x: 0, y: 0 });
  });

  it('跟打段等判定完（leave）才离开', () => {
    const waiting: CursorStop[] = [
      { beat: 0, x: 0, y: 0, leave: 0.2 },
      { beat: 1, x: 80, y: 0 },
    ];
    // 出发：max(0.2, 1 - 0.25 - 0.5) = 0.25，到位 0.75
    expect(cursorAt(waiting, 0.22, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(waiting, 0.5, options).x).toBeCloseTo(40, 10);
  });

  it('时间不够时离开后用最短时长移过去，不瞬移', () => {
    const tight: CursorStop[] = [
      { beat: 0, x: 0, y: 0, leave: 0.4 },
      { beat: 0.5, x: 10, y: 0 },
    ];
    // 0.5 - 0.25 = 0.25 早于离开时间 0.4：改成 0.4 出发、用 1/16 拍移过去
    expect(cursorAt(tight, 0.4, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(tight, 0.4 + 1 / 32, options).x).toBeCloseTo(5, 10);
    expect(cursorAt(tight, 0.5, options)).toEqual({ x: 10, y: 0 });
  });
});
