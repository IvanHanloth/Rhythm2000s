import { describe, expect, it } from 'vite-plus/test';
import { chartFromPatterns } from './test-charts.ts';
import { buildTurnCues, checkTurnCueSpacing, turnCueAt } from './turn-cue.ts';

describe('buildTurnCues', () => {
  it('back-to-back phrases: switch half a beat early, no gap between cues', () => {
    const chart = chartFromPatterns([[0], [0]]);

    expect(buildTurnCues(chart)).toEqual([
      { turn: 'call', phrase: 0, start: 3.5, end: 7.5 },
      { turn: 'response', phrase: 0, start: 7.5, end: 11.5 },
      { turn: 'call', phrase: 1, start: 11.5, end: 15.5 },
      { turn: 'response', phrase: 1, start: 15.5, end: 20 },
    ]);
  });

  it('the last Your turn lasts until the phrase ends', () => {
    const chart = chartFromPatterns([[0]]);
    const cues = buildTurnCues(chart);

    expect(turnCueAt(cues, 11.9)?.turn).toBe('response');
    expect(turnCueAt(cues, 12)).toBeNull();
  });
});

describe('with a gap', () => {
  it('Your turn appears half a beat before the call bar ends and lasts through the gap and the response bar', () => {
    const chart = chartFromPatterns([[0], [0]], { responseGapBeats: 4 });

    expect(buildTurnCues(chart)).toEqual([
      { turn: 'call', phrase: 0, start: 3.5, end: 7.5 },
      { turn: 'response', phrase: 0, start: 7.5, end: 15.5 },
      { turn: 'call', phrase: 1, start: 15.5, end: 19.5 },
      { turn: 'response', phrase: 1, start: 19.5, end: 28 },
    ]);
  });
});

describe('turnCueAt', () => {
  const chart = chartFromPatterns([[0]]);
  const cues = buildTurnCues(chart);

  it('nothing in the first half of the count-in; Follow me shows for the last half beat', () => {
    expect(turnCueAt(cues, 3)).toBeNull();
    expect(turnCueAt(cues, 3.5)?.turn).toBe('call');
  });

  it('switches to Your turn half a beat before the response bar', () => {
    expect(turnCueAt(cues, 7.49)?.turn).toBe('call');
    expect(turnCueAt(cues, 7.5)?.turn).toBe('response');
  });
});

describe('checkTurnCueSpacing', () => {
  it("no error when the last event's window closes before the cue switches", () => {
    expect(checkTurnCueSpacing(chartFromPatterns([[0, 3.25]]), 0.1)).toEqual([]);
  });

  it('events too late report the path and the latest allowed beat, for both call and response', () => {
    // The second phrase only exists to make the first phrase's Your turn switch away early
    expect(checkTurnCueSpacing(chartFromPatterns([[0, 3.5], [0]]), 0.1)).toEqual([
      'phrases[0].call[1]: beat 3.5 is too late; the cue would switch before judging ends. At 120 BPM it must be before beat 3.3',
      'phrases[0].response[1]: beat 3.5 is too late; the cue would switch before judging ends. At 120 BPM it must be before beat 3.3',
    ]);
  });

  it('two-press actions go by the second press: right-click refresh can be at most beat 2.75', () => {
    const ok = chartFromPatterns([[0, 2.75], [0]], {
      phrases: [
        { call: [{ beat: 2.75, action: 'desktop-refresh' }] },
        { call: [{ beat: 0, action: 'dialog-info' }] },
      ],
    });
    expect(checkTurnCueSpacing(ok, 0.1)).toEqual([]);

    const late = chartFromPatterns([], {
      phrases: [
        { call: [{ beat: 3, action: 'desktop-refresh' }] },
        { call: [{ beat: 0, action: 'dialog-info' }] },
      ],
    });
    expect(checkTurnCueSpacing(late, 0.1)[0]).toBe(
      'phrases[0].call[0]: beat 3 is too late; the cue would switch before judging ends. At 120 BPM it must be before beat 2.8',
    );
  });

  it("the last phrase's Your turn lasts until the phrase ends, so its response can be later", () => {
    const errors = checkTurnCueSpacing(chartFromPatterns([[0, 3.5]]), 0.1);
    expect(errors.map((e) => e.split(':')[0])).toEqual(['phrases[0].call[1]']);
  });
});
