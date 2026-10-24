// Judging the wait and hold actions (doc/scenes/windows-xp-levels.md "Judging").

import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { XpSession } from './session.ts';
import { buildBackingTrack, type XpSongSounds } from './song.ts';
import { fakeContext } from '@/scenes/shared/test-audio.ts';

/** Sounds named by strings in place of real AudioBuffers */
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
      'volumeRelease',
    ].map((n) => [n, n]),
  ),
  dialogs: Object.fromEntries(Object.keys(DIALOG_KINDS).map((kind) => [kind, kind])),
  download: { appear: 'downloadAppear', open: 'downloadOpen' },
} as unknown as XpSongSounds;

/** One phrase with `action` at `beat` of the call bar, repeated in the response */
function chartWith(action: 'volume-mute' | 'progress-download', beat = 0) {
  return buildChart(sourceFromPatterns([[0]], { phrases: [{ call: [{ beat, action }] }] }));
}

describe('volume-mute: only the press is judged', () => {
  it('a hit press is judged once and released automatically 1 beat later with volumeRelease', () => {
    const { context, played, scheduled } = fakeContext();
    const session = new XpSession(context, chartWith('volume-mute'), sounds);
    const state = session.targets[0]!;
    const [press, release] = state.clicks;

    const tapTime = session.timeAt(press!.beat) + 0.02;
    expect(session.tap(tapTime)?.level).toBe('perfect');
    expect(session.counts()).toEqual({ perfect: 1, good: 0, miss: 0 });
    expect(session.targetCount).toBe(1);
    const beat = 60 / session.chart.bpm;
    expect(release!.hitAt).toBeCloseTo(tapTime + beat);
    expect(state.handledAt).toBeCloseTo(tapTime + beat);
    expect(played).toEqual(['close']);
    expect(scheduled).toEqual([{ name: 'volumeRelease', when: 10 + beat }]);
  });

  it('nothing more is judged after the press, however long it is held', () => {
    const { context } = fakeContext();
    const session = new XpSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.targets[0]!.clicks;

    session.tap(session.timeAt(press!.beat));
    session.update(session.timeAt(release!.beat) + 1);
    expect(session.judgements).toHaveLength(1);
    expect(session.counts().miss).toBe(0);
  });

  it('a missed press is one Miss and no automatic release', () => {
    const { context, played } = fakeContext();
    const session = new XpSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.targets[0]!.clicks;

    session.update(session.timeAt(press!.beat) + 0.15);
    expect(session.counts()).toEqual({ perfect: 0, good: 0, miss: 1 });
    expect(release!.hitAt).toBeNull();
    expect(session.targets[0]!.handledAt).toBeNull();
    expect(played).toEqual(['miss']);
  });

  it('pressing on the release beat counts for nothing: there is no target there', () => {
    const { context } = fakeContext();
    const session = new XpSession(context, chartWith('volume-mute'), sounds);
    const [, release] = session.targets[0]!.clicks;
    expect(session.tap(session.timeAt(release!.beat))).toBeNull();
  });
});

describe('progress-download: waiting for the bar', () => {
  it('is judged 3 beats after the event; a hit as the bar fills plays downloadOpen', () => {
    const { context, played } = fakeContext();
    const session = new XpSession(context, chartWith('progress-download'), sounds);
    const state = session.targets[0]!;
    expect(state.clicks.map((c) => c.beat - state.response.beat)).toEqual([3]);

    // Clicking as it opens is far from the target and scores nothing (the disabled button ignores it)
    expect(session.tap(session.timeAt(state.response.beat))).toBeNull();
    expect(session.tap(session.timeAt(state.clicks[0]!.beat))?.level).toBe('perfect');
    expect(played).toEqual(['downloadOpen']);
  });

  it('backing track: the call opens and clicks Open as the bar fills; the response only opens', () => {
    const chart = chartWith('progress-download');
    const track = buildBackingTrack(chart, sounds);
    const at = (name: string) =>
      track.filter((s) => (s.buffer as unknown as string) === name).map((s) => s.beat);
    const call = chart.calls[0]!.beat;
    const response = chart.responses[0]!.beat;
    expect(at('downloadAppear')).toEqual([call, response]);
    expect(at('downloadOpen')).toEqual([call + 3]);
  });
});
