import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '../rhythm/chart.ts';
import { buildLevels, formatRecord, levelRoute, nextLevel, parseRoute } from './levels.ts';

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
  it('按场景登记顺序排，场景内按谱面清单顺序编号', () => {
    const levels = buildLevels(scenes, charts);
    expect(levels.map((l) => `${l.id}#${l.number}`)).toEqual(['x1#1', 'x2#2', 'm1#1']);
    expect(levels[0]!.actions).toBe('错误消息框、警告消息框');
  });

  it('下一关跨场景接着往下走，最后一关之后没有了', () => {
    const levels = buildLevels(scenes, charts);
    expect(nextLevel(levels, 'x2')?.id).toBe('m1');
    expect(nextLevel(levels, 'm1')).toBeNull();
  });
});

describe('parseRoute', () => {
  const ids = scenes.map((s) => s.id);

  it('空的、认不出来的都回街区', () => {
    expect(parseRoute('', ids)).toEqual({ kind: 'hub' });
    expect(parseRoute('#street', ids)).toEqual({ kind: 'hub' });
    expect(parseRoute('#nope/x1', ids)).toEqual({ kind: 'hub' });
  });

  it('#场景 和 #场景/谱面', () => {
    expect(parseRoute('#mac-2000', ids)).toEqual({ kind: 'scene', sceneId: 'mac-2000' });
    expect(parseRoute('#windows-xp/x2', ids)).toEqual({
      kind: 'scene',
      sceneId: 'windows-xp',
      chartId: 'x2',
    });
  });

  it('和 levelRoute 互逆', () => {
    const level = buildLevels(scenes, charts)[1]!;
    expect(parseRoute(`#${levelRoute(level)}`, ids)).toEqual({
      kind: 'scene',
      sceneId: 'windows-xp',
      chartId: 'x2',
    });
  });
});

describe('formatRecord', () => {
  it('计数加评级', () => {
    expect(formatRecord({ perfect: 9, good: 1, miss: 0 })).toBe(
      'Perfect 9 · Good 1 · Miss 0（优秀）',
    );
  });
});
