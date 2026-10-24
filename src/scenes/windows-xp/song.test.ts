import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { buildBackingTrack, type XpSongSounds } from './song.ts';
import { loadMvpChart } from './test-mvp-chart.ts';

/** Sounds named by strings in place of real AudioBuffers; only checks what gets booked */
const sounds = {
  ...Object.fromEntries(
    [
      'kick',
      'snare',
      'hat',
      'countAccent',
      'count',
      'close',
      'rightClick',
      'menuCommand',
      'miss',
      'result',
    ].map((n) => [n, n]),
  ),
  dialogs: Object.fromEntries(Object.keys(DIALOG_KINDS).map((kind) => [kind, kind])),
} as unknown as XpSongSounds;

describe('the MVP chart file', () => {
  it('has 8 phrases of call and response with no gap, 72 beats in all', () => {
    const chart = loadMvpChart();
    expect(chart.phrases).toHaveLength(8);
    expect(chart.phrases[0]).toEqual({ callStart: 4, callEnd: 8, responseStart: 8, end: 12 });
    expect(chart.endBeat).toBe(4 + 8 * 8 + 4);
  });
});

describe('buildBackingTrack', () => {
  const chart = loadMvpChart();
  const track = buildBackingTrack(chart, sounds);
  const at = (beat: number) =>
    track
      .filter((s) => s.beat === beat)
      .map((s) => s.buffer as unknown as string)
      .sort();

  it('the count-in is metronome clicks, accented on beat 1', () => {
    expect(at(0)).toEqual(['countAccent', 'hat']);
    expect(at(1)).toEqual(['count', 'hat']);
  });

  it('every call has an alert sound of its message box kind', () => {
    const popups = track.filter((s) => (s.buffer as unknown as string).startsWith('dialog-'));
    expect(popups.map((s) => s.beat)).toEqual(chart.calls.map((c) => c.beat));
    expect(popups.map((s) => s.buffer)).toEqual(chart.calls.map((c) => c.action));
  });

  it('the response has drums only, no cues', () => {
    const response = chart.responses[0]!.beat;
    expect(at(response)).toEqual(['hat', 'kick']);
  });

  it('the last bar is a single hit, then silence', () => {
    const lastBar = chart.endBeat - 4;
    expect(at(lastBar)).toEqual(['kick', 'snare']);
    expect(track.every((s) => s.beat <= lastBar)).toBe(true);
  });
});

describe('desktop-refresh demo', () => {
  it('the virtual mouse right-clicks on the beat and clicks Refresh half a beat later, one sound each', () => {
    const chart = buildChart(
      sourceFromPatterns([[0]], { phrases: [{ call: [{ beat: 1, action: 'desktop-refresh' }] }] }),
    );
    const clicks = buildBackingTrack(chart, sounds)
      .filter((s) => ['rightClick', 'menuCommand'].includes(s.buffer as unknown as string))
      .map((s) => `${s.beat}:${s.buffer as unknown as string}`);
    // The call bar starts on beat 4; only the call has cues
    expect(clicks).toEqual(['5:rightClick', '5.5:menuCommand']);
  });
});

describe('backing track with a gap', () => {
  const chart = buildChart(sourceFromPatterns([[0]], { responseGapBeats: 0.5 }));
  const track = buildBackingTrack(chart, sounds);
  const names = (beat: number) =>
    track
      .filter((s) => s.beat === beat)
      .map((s) => s.buffer as unknown as string)
      .sort();

  it('call and response bars each restart the drums on their first beat, in line with the targets', () => {
    const drums = track
      .filter((s) => ['kick', 'snare'].includes(s.buffer as unknown as string))
      .map((s) => `${s.beat}:${s.buffer as unknown as string}`);
    // Call 4–8, gap 8–8.5, response 8.5–12.5
    expect(drums).toEqual([
      '4:kick',
      '5:snare',
      '6:kick',
      '7:snare',
      '8.5:kick',
      '9.5:snare',
      '10.5:kick',
      '11.5:snare',
      '12.5:kick',
      '12.5:snare',
    ]);
  });

  it('the gap has only hi-hats', () => {
    expect(names(8)).toEqual(['hat']);
  });
});
