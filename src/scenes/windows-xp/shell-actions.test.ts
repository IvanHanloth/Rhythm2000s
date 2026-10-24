import { describe, expect, it } from 'vite-plus/test';
import type { ActionType } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { checkWindowsXpChart } from './chart-rules.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { SHELL_ACTIONS } from './shell-actions.ts';
import { buildBackingTrack, hitSound, type XpSongSounds } from './song.ts';

/** Sounds named by strings in place of real AudioBuffers; only checks what gets booked */
const sounds = {
  ...Object.fromEntries(
    ['kick', 'snare', 'hat', 'countAccent', 'count', 'close', 'rightClick', 'menuCommand'].map(
      (n) => [n, n],
    ),
  ),
  miss: 'miss',
  result: 'result',
  dialogs: Object.fromEntries(Object.keys(DIALOG_KINDS).map((kind) => [kind, kind])),
  shell: Object.fromEntries(
    Object.entries(SHELL_ACTIONS).map(([action, info]) => [
      action,
      { appear: info.appear, handled: info.handled },
    ]),
  ),
} as unknown as XpSongSounds;

/** One phrase with these actions at these beats of the call bar */
function chartWith(events: [number, ActionType][]) {
  return buildChart(
    sourceFromPatterns([[0]], {
      phrases: [{ call: events.map(([beat, action]) => ({ beat, action })) }],
    }),
  );
}

describe('shell action cues in the call', () => {
  const name = (s: { buffer: AudioBuffer }) => s.buffer as unknown as string;
  const cues = (events: [number, ActionType][]) =>
    buildBackingTrack(chartWith(events), sounds)
      .filter((s) => !['kick', 'snare', 'hat', 'count', 'countAccent'].includes(name(s)))
      .map((s) => `${s.beat}:${name(s)}`);

  it('balloons, program windows and files sound their appearance on the beat', () => {
    // The call bar starts on beat 4
    expect(
      cues([
        [0, 'balloon-info'],
        [1, 'window-minimize'],
        [2, 'recycle-bin'],
      ]),
    ).toEqual(['4:balloon', '5:restore', '6:fileDrop']);
  });

  it('the Start menu demo clicks Start on the beat and an item half a beat later', () => {
    expect(cues([[1, 'start-menu']])).toEqual(['5:close', '5.5:menuCommand']);
  });
});

describe('shell action hit sounds', () => {
  it('each action has its own sound', () => {
    expect(hitSound(sounds, 'balloon-info', 0)).toBe('navigate');
    expect(hitSound(sounds, 'window-minimize', 0)).toBe('minimize');
    expect(hitSound(sounds, 'recycle-bin', 0)).toBe('recycle');
    expect(hitSound(sounds, 'start-menu', 0)).toBe('close');
    expect(hitSound(sounds, 'start-menu', 1)).toBe('menuCommand');
  });
});

describe('per-phrase limits', () => {
  const repeat = (action: ActionType, n: number): [number, ActionType][] =>
    Array.from({ length: n }, (_, i) => [i * 0.5, action]);

  it('no errors within the limits', () => {
    expect(checkWindowsXpChart(chartWith(repeat('balloon-info', 3)))).toEqual([]);
    expect(checkWindowsXpChart(chartWith(repeat('window-minimize', 4)))).toEqual([]);
    expect(checkWindowsXpChart(chartWith(repeat('recycle-bin', 6)))).toEqual([]);
  });

  it('reports going over a limit', () => {
    expect(checkWindowsXpChart(chartWith(repeat('balloon-info', 4)))).toEqual([
      'phrases[0]: 4 balloon-info, the XP scene allows at most 3 per phrase',
    ]);
    expect(checkWindowsXpChart(chartWith(repeat('window-minimize', 5)))).toEqual([
      'phrases[0]: 5 window-minimize, the XP scene allows at most 4 per phrase',
    ]);
    expect(checkWindowsXpChart(chartWith(repeat('recycle-bin', 7)))).toEqual([
      'phrases[0]: 7 recycle-bin, the XP scene allows at most 6 per phrase',
    ]);
  });

  it('message boxes and program windows share 6 slots', () => {
    const events: [number, ActionType][] = [
      ...repeat('dialog-info', 4),
      [2, 'window-minimize'],
      [2.5, 'window-minimize'],
      [3, 'window-minimize'],
    ];
    expect(checkWindowsXpChart(chartWith(events))).toEqual([
      'phrases[0]: 7 message boxes and program windows, the XP scene allows at most 6 per phrase',
    ]);
  });
});
