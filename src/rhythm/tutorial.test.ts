import { describe, expect, it } from 'vite-plus/test';
import { ACTION_TYPES } from './actions.ts';
import { buildChart } from './chart.ts';
import { sourceFromPatterns } from './test-charts.ts';
import {
  buildTutorialChart,
  chartSegment,
  tutorialHint,
  tutorialPassed,
  tutorialStops,
} from './tutorial.ts';

const chart = buildChart(
  sourceFromPatterns([[0]], {
    bpm: 100,
    phrases: [
      { call: [{ beat: 1, action: 'volume-mute' }] },
      {
        call: [
          { beat: 0, action: 'dialog-info' },
          { beat: 1, action: 'volume-mute' },
        ],
      },
      { call: [{ beat: 0, action: 'progress-download' }] },
    ],
  }),
);

describe('tutorialStops', () => {
  it('stops before each phrase that brings in new actions, listing only those, in order of appearance', () => {
    expect(tutorialStops(chart)).toEqual([
      { phrase: 0, actions: ['volume-mute'] },
      { phrase: 1, actions: ['dialog-info'] },
      { phrase: 2, actions: ['progress-download'] },
    ]);
  });

  it('counts an action that is only in a response as new in that phrase', () => {
    const responseOnly = buildChart(
      sourceFromPatterns([[0]], {
        phrases: [
          { call: [{ beat: 0, action: 'dialog-info' }] },
          { call: [{ beat: 0, action: 'dialog-info' }] },
          {
            call: [{ beat: 0, action: 'dialog-info' }],
            response: [{ beat: 0, action: 'dialog-error' }],
          },
        ],
      }),
    );
    expect(tutorialStops(responseOnly)).toEqual([
      { phrase: 0, actions: ['dialog-info'] },
      { phrase: 2, actions: ['dialog-error'] },
    ]);
  });
});

describe('chartSegment', () => {
  // 1 count-in bar, then phrases of 9 beats (call, 1-beat gap, response) at 4, 13 and 22, a 1-bar outro: ends at 35
  const long = buildChart(
    sourceFromPatterns([[0], [1], [2]], { responseGapBeats: 1, countInBars: 1, outroBars: 1 }),
  );

  it('returns the same timeline when it covers the whole chart', () => {
    expect(chartSegment(long, 0, 3)).toEqual(long);
  });

  it('keeps the count-in for the first piece and drops the outro when phrases follow', () => {
    const piece = chartSegment(long, 0, 1);
    expect(piece.phrases).toEqual([{ callStart: 4, callEnd: 8, responseStart: 9, end: 13 }]);
    expect(piece.calls.map((c) => [c.beat, c.phrase])).toEqual([[4, 0]]);
    expect(piece.endBeat).toBe(13);
  });

  it('gives later pieces one count-in bar, renumbers phrases from 0 and keeps the outro at the end', () => {
    const piece = chartSegment(long, 1, 3);
    expect(piece.id).toBe('test--phrases-1-3');
    expect(piece.phrases.map((p) => p.callStart)).toEqual([4, 13]);
    expect(piece.calls.map((c) => [c.beat, c.phrase])).toEqual([
      [5, 0],
      [15, 1],
    ]);
    expect(piece.responses.map((c) => [c.beat, c.phrase])).toEqual([
      [10, 0],
      [20, 1],
    ]);
    expect(piece.endBeat).toBe(26);
  });

  it('rejects an empty or out-of-range piece', () => {
    expect(() => chartSegment(long, 2, 2)).toThrow();
    expect(() => chartSegment(long, 2, 4)).toThrow();
  });
});

describe('buildTutorialChart', () => {
  it('keeps tempo and metre; one count-in bar and one phrase with the action on beat 1, no outro', () => {
    const tutorial = buildTutorialChart(chart, 'progress-download');
    expect(tutorial.bpm).toBe(100);
    expect(tutorial.phrases).toEqual([{ callStart: 4, callEnd: 8, responseStart: 8, end: 12 }]);
    expect(tutorial.calls.map((c) => [c.beat, c.action])).toEqual([[4, 'progress-download']]);
    expect(tutorial.responses.map((c) => [c.beat, c.action])).toEqual([[8, 'progress-download']]);
    expect(tutorial.endBeat).toBe(12);
  });
});

describe('tutorialPassed', () => {
  it('passes only when every press is judged without a Miss', () => {
    expect(tutorialPassed(['perfect', 'good'], 2)).toBe(true);
    expect(tutorialPassed(['perfect', 'miss'], 2)).toBe(false);
    expect(tutorialPassed(['perfect'], 2)).toBe(false);
  });
});

describe('tutorialHint', () => {
  it('hint texts are plain English', () => {
    for (const action of ACTION_TYPES) {
      const { name, how } = tutorialHint(action);
      expect(`${name}${how}`).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});
