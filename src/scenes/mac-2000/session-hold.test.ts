// Judging the later Mac actions: menu-volume's automatic release, sheet-save's two presses and the
// ichat-message limit (doc/scenes/mac-2000.md "Gameplay").

import { describe, expect, it } from 'vite-plus/test';
import type { ActionType } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { checkMacChart } from './chart-rules.ts';
import { buildTargets, MacSession } from './session.ts';
import { buildBackingTrack, type MacSongSounds } from './song.ts';
import { fakeContext } from '@/scenes/shared/test-audio.ts';

/** Sounds named by strings in place of real AudioBuffers */
const names = ['kick', 'snare', 'hat', 'countAccent', 'count', 'handled', 'miss', 'result'];
const sounds = {
  ...Object.fromEntries(names.map((n) => [n, n])),
  actions: new Proxy({}, { get: (_, action) => action }),
  byName: new Proxy({}, { get: (_, name) => `sound:${String(name)}` }),
} as unknown as MacSongSounds;

/** One [beat, action] list per phrase */
function macChart(phrases: [number, ActionType][][]) {
  return buildChart(
    sourceFromPatterns([], {
      scene: 'mac-2000',
      phrases: phrases.map((events) => ({
        call: events.map(([beat, action]) => ({ beat, action })),
      })),
    }),
  );
}

describe('menu-volume: only the press is judged, released 1 beat later', () => {
  it('a hit press is judged once; the game releases 1 beat later, playing Tink then booking Pop', () => {
    const { context, played, scheduled } = fakeContext();
    const session = new MacSession(context, macChart([[[0, 'menu-volume']]]), sounds);
    const [press, release] = session.targets[0]!.clicks;
    const pressTime = session.timeAt(press!.beat);

    expect(session.targetCount).toBe(1);
    expect(session.tap(pressTime)?.level).toBe('perfect');
    expect(release!.hitAt).toBeCloseTo(pressTime + (release!.beat - press!.beat) * (60 / 120));
    expect(session.targets[0]!.handledAt).toBe(release!.hitAt);
    expect(session.counts()).toEqual({ perfect: 1, good: 0, miss: 0 });
    expect(played).toEqual(['sound:Tink']);
    expect(scheduled.map((s) => s.name)).toEqual(['sound:Pop']);
  });

  it('a missed press is one Miss and the release is not judged', () => {
    const { context, played } = fakeContext();
    const session = new MacSession(context, macChart([[[0, 'menu-volume']]]), sounds);
    const [, release] = session.targets[0]!.clicks;
    session.update(session.timeAt(release!.beat) + 0.5);
    expect(session.counts()).toEqual({ perfect: 0, good: 0, miss: 1 });
    expect(release!.hitAt).toBeNull();
    expect(played).toEqual(['miss']);
  });
});

describe('sheet-save', () => {
  it('takes two presses half a beat apart; the call sounds Tink on the second', () => {
    const chart = macChart([[[1, 'sheet-save']]]);
    const target = buildTargets(chart)[0]!;
    expect(target.clicks.map((c) => c.beat - target.response.beat)).toEqual([0, 0.5]);
    const cues = buildBackingTrack(chart, sounds).filter(
      (s) => !names.includes(s.buffer as unknown as string),
    );
    expect(cues.map((s) => [s.beat, s.buffer])).toEqual([
      [5, 'sheet-save'],
      [5.5, 'sound:Tink'],
    ]);
  });

  it('shares the 6 screen slots with alerts and windows', () => {
    const chart = macChart([
      [
        [0, 'sheet-save'],
        [1, 'alert-note'],
        [1.5, 'sheet-save'],
      ],
    ]);
    expect(buildTargets(chart).map((t) => [t.kind, t.order])).toEqual([
      ['sheet', 0],
      ['alert', 1],
      ['sheet', 2],
    ]);
  });
});

describe('ichat-message', () => {
  it('reports more than 3 in one phrase', () => {
    const errors = checkMacChart(
      macChart([
        [
          [0, 'ichat-message'],
          [1, 'ichat-message'],
          [2, 'ichat-message'],
          [3, 'ichat-message'],
        ],
      ]),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ichat-message');
  });
});
