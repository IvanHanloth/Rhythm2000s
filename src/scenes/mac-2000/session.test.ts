import { describe, expect, it } from 'vite-plus/test';
import type { ActionType } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { checkMacChart } from './chart-rules.ts';
import { buildTargets } from './session.ts';
import { buildBackingTrack, type MacSongSounds } from './song.ts';

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

describe('buildTargets', () => {
  it('alerts and windows share screen slots, dock-bounce and mail count separately; each phrase restarts at 0', () => {
    const chart = macChart([
      [
        [0, 'alert-note'],
        [1, 'dock-bounce'],
        [2, 'window-miniaturize'],
        [3, 'dock-bounce'],
      ],
      [
        [0, 'mail-new'],
        [1, 'alert-stop'],
      ],
    ]);
    const targets = buildTargets(chart);
    expect(targets.map((t) => [t.kind, t.order])).toEqual([
      ['alert', 0],
      ['dock', 0],
      ['window', 1],
      ['dock', 1],
      ['mail', 0],
      ['alert', 0],
    ]);
    expect(targets[0]!.response).toBe(chart.responses[0]);
  });

  it('menu-apple takes two response presses half a beat apart; files take cells in phrase order', () => {
    const chart = macChart([
      [
        [0, 'menu-apple'],
        [1, 'dock-trash'],
        [2, 'dock-trash'],
      ],
    ]);
    const targets = buildTargets(chart);
    expect(targets.map((t) => [t.kind, t.order])).toEqual([
      ['menu', 0],
      ['file', 0],
      ['file', 1],
    ]);
    const response = chart.responses[0]!.beat;
    expect(targets[0]!.clicks.map((c) => c.beat)).toEqual([response, response + 0.5]);
    expect(targets[1]!.clicks).toHaveLength(1);
  });
});

describe('checkMacChart', () => {
  it('no errors when call and response match', () => {
    expect(checkMacChart(macChart([[[0, 'alert-note']]]))).toEqual([]);
  });

  it('reports more than 6 alerts and windows in one phrase', () => {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    const errors = checkMacChart(
      macChart([beats.map((b, i) => [b, i % 2 ? 'alert-note' : 'window-miniaturize'])]),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('at most 6');
  });

  it('reports more than 6 dock-trash in one phrase', () => {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    const errors = checkMacChart(macChart([beats.map((b) => [b, 'dock-trash'])]));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('dock-trash');
  });

  it('reports a response action that differs from the call', () => {
    const chart = buildChart(
      sourceFromPatterns([], {
        scene: 'mac-2000',
        phrases: [
          {
            call: [{ beat: 0, action: 'mail-new' }],
            response: [{ beat: 0, action: 'dock-bounce' }],
          },
        ],
      }),
    );
    expect(checkMacChart(chart)[0]).toContain('mail-new');
  });
});

describe('buildBackingTrack', () => {
  const names = ['kick', 'snare', 'hat', 'countAccent', 'count', 'handled', 'miss', 'result'];
  const sounds = {
    ...Object.fromEntries(names.map((n) => [n, n])),
    actions: new Proxy({}, { get: (_, action) => action }),
    byName: new Proxy({}, { get: (_, name) => `sound:${String(name)}` }),
  } as unknown as MacSongSounds;

  it('every call action sounds its cue on the beat; the response has none', () => {
    const chart = macChart([
      [
        [0, 'alert-caution'],
        [1.5, 'dock-bounce'],
      ],
    ]);
    const track = buildBackingTrack(chart, sounds);
    const cues = track.filter((s) => !names.includes(s.buffer as unknown as string));
    expect(cues.map((s) => [s.beat, s.buffer])).toEqual([
      [4, 'alert-caution'],
      [5.5, 'dock-bounce'],
    ]);
  });

  it('menu-apple also sounds its second demonstrated press on the beat', () => {
    const chart = macChart([[[1, 'menu-apple']]]);
    const track = buildBackingTrack(chart, sounds);
    const cues = track.filter((s) => !names.includes(s.buffer as unknown as string));
    expect(cues.map((s) => [s.beat, s.buffer])).toEqual([
      [5, 'menu-apple'],
      [5.5, 'sound:Tink'],
    ]);
  });
});
