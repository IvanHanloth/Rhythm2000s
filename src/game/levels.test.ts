import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '@/rhythm/chart.ts';
import { buildLevels, formatBestScore, parseRoute } from './levels.ts';

function chart(id: string, scene: string, actions: string[]) {
  return buildChart({
    format: 1,
    id,
    title: id.toUpperCase(),
    scene,
    bpm: 120,
    beatsPerBar: 4,
    countInBars: 1,
    outroBars: 1,
    phrases: [{ call: actions.map((action, beat) => ({ beat, action })) }],
  } as Parameters<typeof buildChart>[0]);
}

const scenes = [
  { id: 'windows-xp', label: 'XP' },
  { id: 'mac-2000', label: 'Mac' },
];
const charts = [
  chart('m1', 'mac-2000', ['dock-bounce']),
  chart('x1', 'windows-xp', ['dialog-error', 'dialog-warning', 'dialog-error']),
  chart('x2', 'windows-xp', ['dialog-info']),
];

describe('buildLevels', () => {
  it('orders by scene registration, numbering levels within a scene in index order', () => {
    const levels = buildLevels(scenes, charts);
    expect(levels.map((l) => `${l.id}#${l.number}`)).toEqual(['x1#1', 'x2#2', 'm1#1']);
    expect(levels[0]!.actions).toBe('Error box, Warning box');
  });
});

describe('parseRoute', () => {
  const ids = scenes.map((s) => s.id);

  it('empty or unknown routes go back to the street', () => {
    expect(parseRoute('', ids)).toEqual({ kind: 'hub' });
    expect(parseRoute('#street', ids)).toEqual({ kind: 'hub' });
    expect(parseRoute('#nope/x1', ids)).toEqual({ kind: 'hub' });
  });

  it('#scene and #scene/chart', () => {
    expect(parseRoute('#mac-2000', ids)).toEqual({ kind: 'scene', sceneId: 'mac-2000' });
    expect(parseRoute('#windows-xp/x2', ids)).toEqual({
      kind: 'scene',
      sceneId: 'windows-xp',
      chartId: 'x2',
    });
  });
});

describe('formatBestScore', () => {
  it('pads to five digits; null with no score', () => {
    expect(formatBestScore(4250)).toBe('Best score 04250');
    expect(formatBestScore(null)).toBeNull();
    expect(formatBestScore(4250, true)).toBe('Best score 04250 (Beat Guide)');
  });
});
