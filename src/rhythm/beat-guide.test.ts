import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from './chart.ts';
import { guideHolds, guideMarks, guidePulse, holdSpans, pressBeats } from './beat-guide.ts';
import { chartFromPatterns, sourceFromPatterns } from './test-charts.ts';

describe('pressBeats', () => {
  it('lists every response press in order', () => {
    // count-in 4 beats, call bar 4–8, response bar 8–12
    const chart = chartFromPatterns([[0, 1.5, 3]]);
    expect(pressBeats(chart)).toEqual([8, 9.5, 11]);
  });

  it('counts both presses of a two-step action but skips auto steps', () => {
    const source = sourceFromPatterns([[0]], {}, 'desktop-refresh');
    expect(pressBeats(buildChart(source))).toEqual([8, 8.5]);
    const volume = sourceFromPatterns([[0]], {}, 'volume-mute');
    expect(pressBeats(buildChart(volume))).toEqual([8]);
  });
});

describe('guideMarks', () => {
  const presses = [8, 9.5];

  it('shows one mark per beat up to 4 beats ahead', () => {
    expect(guideMarks(2, 20, presses).map((m) => m.distance)).toEqual([0, 1, 2, 3, 4]);
  });

  it('marks press beats, including off-beat ones', () => {
    const marks = guideMarks(6, 20, presses);
    expect(marks.map(({ distance, press }) => [distance, press])).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [3, false],
      [3.5, true],
      [4, false],
    ]);
    expect(marks.every((m) => !m.holdEnd)).toBe(true);
  });

  it('keeps a mark briefly after its beat, then drops it', () => {
    const [first] = guideMarks(8.1, 20, presses);
    expect(first?.press).toBe(true);
    expect(first?.distance).toBeCloseTo(-0.1);
    expect(guideMarks(8.3, 20, presses)[0]?.distance).toBeCloseTo(0.7);
  });

  it('shows nothing before beat 0 or after the end', () => {
    expect(guideMarks(-5, 20, []).length).toBe(0);
    expect(guideMarks(19, 20, []).map((m) => m.distance)).toEqual([0, 1]);
  });
});

describe('guidePulse', () => {
  it('is strongest on the beat and fades within a quarter beat', () => {
    expect(guidePulse(3, []).strength).toBe(1);
    expect(guidePulse(3.125, []).strength).toBeCloseTo(0.5);
    expect(guidePulse(3.5, []).strength).toBe(0);
    expect(guidePulse(-0.1, []).strength).toBe(0);
  });

  it('flashes on press beats, off-beat ones too', () => {
    expect(guidePulse(8.1, [8]).press).toBe(true);
    expect(guidePulse(7.1, [8]).press).toBe(false);
    expect(guidePulse(9.5, [9.5])).toEqual({ strength: 1, press: true });
  });
});

describe('volume hold', () => {
  // volume-mute: press on the beat, released by the game 1 beat later
  const chart = buildChart(sourceFromPatterns([[0]], {}, 'volume-mute'));
  const holds = holdSpans(chart);

  it('spans from the press to the automatic release', () => {
    expect(holds).toEqual([{ start: 8, end: 9 }]);
    expect(holdSpans(chartFromPatterns([[0, 2]]))).toEqual([]);
  });

  it('marks the release beat as a hold end, not a press', () => {
    const marks = guideMarks(6, chart.endBeat, pressBeats(chart), holds);
    expect(marks.find((m) => m.distance === 2)).toMatchObject({ press: true, holdEnd: false });
    expect(marks.find((m) => m.distance === 3)).toMatchObject({ press: false, holdEnd: true });
  });

  it('keeps the bar attached to the centre until the release', () => {
    expect(guideHolds(6, holds)).toEqual([{ from: 2, to: 3, active: false }]);
    expect(guideHolds(8.5, holds)).toEqual([{ from: 0, to: 0.5, active: true }]);
    expect(guideHolds(9.1, holds)).toEqual([]);
  });

  it('keeps the centre yellow while holding', () => {
    const presses = pressBeats(chart);
    expect(guidePulse(8.7, presses, holds).press).toBe(true);
    expect(guidePulse(9.3, presses, holds).press).toBe(false);
  });
});
