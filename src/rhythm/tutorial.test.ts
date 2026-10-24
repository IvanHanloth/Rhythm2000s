import { describe, expect, it } from 'vite-plus/test';
import { ACTION_TYPES } from './actions.ts';
import { buildChart } from './chart.ts';
import { sourceFromPatterns } from './test-charts.ts';
import { buildTutorialChart, tutorialActions, tutorialHint, tutorialPassed } from './tutorial.ts';

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

describe('tutorialActions', () => {
  it('lists actions in order of first appearance, without repeats', () => {
    expect(tutorialActions(chart)).toEqual(['volume-mute', 'dialog-info', 'progress-download']);
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
