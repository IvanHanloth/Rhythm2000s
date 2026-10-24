import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from './chart.ts';
import { chartFromPatterns, sourceFromPatterns } from './test-charts.ts';

describe('buildChart', () => {
  it('without response, the response repeats the call exactly one bar later', () => {
    const chart = chartFromPatterns([[0, 1, 2]]);

    expect(chart.calls.map((c) => c.beat)).toEqual([4, 5, 6]);
    expect(chart.responses.map((c) => c.beat)).toEqual([8, 9, 10]);
    expect(chart.phrases).toEqual([{ callStart: 4, callEnd: 8, responseStart: 8, end: 12 }]);
  });

  it('a top-level responseGapBeats inserts a gap, and phrases can override it', () => {
    const source = sourceFromPatterns([[0], [0], [0]], { responseGapBeats: 4 });
    source.phrases[1]!.responseGapBeats = 2;
    source.phrases[2]!.responseGapBeats = 0;
    const chart = buildChart(source);

    expect(chart.phrases).toEqual([
      { callStart: 4, callEnd: 8, responseStart: 12, end: 16 },
      { callStart: 16, callEnd: 20, responseStart: 22, end: 26 },
      { callStart: 26, callEnd: 30, responseStart: 30, end: 34 },
    ]);
    expect(chart.responses.map((c) => c.beat)).toEqual([12, 22, 30]);
    expect(chart.endBeat).toBe(34 + 4);
  });

  it('without responseGapBeats there is no gap: the response follows the call directly', () => {
    const source = sourceFromPatterns([[0]]);
    delete source.responseGapBeats;
    expect(buildChart(source).phrases).toEqual([
      { callStart: 4, callEnd: 8, responseStart: 8, end: 12 },
    ]);
  });

  it('uses response for the targets when it is written', () => {
    const source = sourceFromPatterns([[0, 1]]);
    source.phrases[0]!.response = [{ beat: 0.5, action: 'dialog-info' }];
    const chart = buildChart(source);

    expect(chart.responses).toEqual([{ beat: 8.5, phrase: 0, index: 0, action: 'dialog-info' }]);
  });

  it('lays phrases out in order, recording phrase index, index within the phrase and action', () => {
    const chart = chartFromPatterns([[0], [0.5, 3]]);

    expect(chart.calls).toEqual([
      { beat: 4, phrase: 0, index: 0, action: 'dialog-info' },
      { beat: 12.5, phrase: 1, index: 0, action: 'dialog-info' },
      { beat: 15, phrase: 1, index: 1, action: 'dialog-info' },
    ]);
  });

  it('song length = count-in + 2 bars per phrase + outro', () => {
    expect(chartFromPatterns([[0], [0], [0]]).endBeat).toBe((1 + 3 * 2 + 1) * 4);
  });

  it('keeps id, title and scene', () => {
    const chart = chartFromPatterns([[0]], { id: 'abc', title: 'Song', scene: 'mac-2000' });
    expect([chart.id, chart.title, chart.scene]).toEqual(['abc', 'Song', 'mac-2000']);
  });
});
