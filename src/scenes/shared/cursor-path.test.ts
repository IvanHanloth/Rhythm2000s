import { describe, expect, it } from 'vite-plus/test';
import { cursorAt, returnToCenterStops, turnGaps, type CursorStop } from './cursor-path.ts';

const options = { leadBeats: 0.25, holdBeats: 0.0625, maxMoveBeats: 0.5 };

describe('cursorAt', () => {
  const stops: CursorStop[] = [
    { beat: 0, x: 0, y: 0 },
    { beat: 2, x: 100, y: 50 },
  ];

  it('waits while the target is far off, leaves at most half a beat early and arrives lead beats early', () => {
    expect(cursorAt(stops, 1.2, options)).toEqual({ x: 0, y: 0 });
    // Leaves at 2 - 0.25 - 0.5 = 1.25, arrives at 1.75
    expect(cursorAt(stops, 1.25, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(stops, 1.5, options)).toEqual({ x: 50, y: 25 });
    expect(cursorAt(stops, 1.75, options)).toEqual({ x: 100, y: 50 });
    expect(cursorAt(stops, 2.1, options)).toEqual({ x: 100, y: 50 });
  });

  it('rests on the first stop before it', () => {
    expect(cursorAt(stops, -3, options)).toEqual({ x: 0, y: 0 });
  });

  it('leaves a response stop only after its leave time', () => {
    const waiting: CursorStop[] = [
      { beat: 0, x: 0, y: 0, leave: 0.2 },
      { beat: 1, x: 80, y: 0 },
    ];
    // Leaves at max(0.2, 1 - 0.25 - 0.5) = 0.25, arrives at 0.75
    expect(cursorAt(waiting, 0.22, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(waiting, 0.5, options).x).toBeCloseTo(40, 10);
  });

  it('takes the minimum move time when short on time instead of jumping', () => {
    const tight: CursorStop[] = [
      { beat: 0, x: 0, y: 0, leave: 0.4 },
      { beat: 0.5, x: 10, y: 0 },
    ];
    // 0.5 - 0.25 = 0.25 is before the leave time 0.4, so it leaves at 0.4 and moves in 1/16 beat
    expect(cursorAt(tight, 0.4, options)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(tight, 0.4 + 1 / 32, options).x).toBeCloseTo(5, 10);
    expect(cursorAt(tight, 0.5, options)).toEqual({ x: 10, y: 0 });
  });
});

describe('returning to the centre after the call', () => {
  const center = { x: 500, y: 300 };

  it('groups by phrase: last call press and first response press', () => {
    expect(
      turnGaps([
        { phrase: 0, callBeats: [4], responseBeats: [8] },
        { phrase: 0, callBeats: [5, 5.5], responseBeats: [9, 9.5] },
        { phrase: 1, callBeats: [12], responseBeats: [16] },
      ]),
    ).toEqual([
      { lastCall: 5.5, firstResponse: 8 },
      { lastCall: 12, firstResponse: 16 },
    ]);
  });

  it('stops at the centre halfway between them, except when they are too close', () => {
    expect(
      returnToCenterStops(
        [
          { lastCall: 4, firstResponse: 8 },
          { lastCall: 11.5, firstResponse: 12 },
        ],
        center,
      ),
    ).toEqual([{ beat: 6, x: 500, y: 300 }]);
  });

  it('goes back to the centre after the call, then out to the target in the response', () => {
    const target = { x: 100, y: 100 };
    const stops = [
      { beat: 4, ...target },
      ...returnToCenterStops([{ lastCall: 4, firstResponse: 8 }], center),
      { beat: 8, ...target },
    ];
    expect(cursorAt(stops, 6, options)).toEqual(center);
    expect(cursorAt(stops, 7.75, options)).toEqual(target);
  });
});
