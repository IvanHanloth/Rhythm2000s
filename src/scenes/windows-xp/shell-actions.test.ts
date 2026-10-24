import { describe, expect, it } from 'vite-plus/test';
import type { ActionType } from '../../rhythm/actions.ts';
import { buildChart } from '../../rhythm/chart.ts';
import { sourceFromPatterns } from '../../rhythm/test-charts.ts';
import { checkWindowsXpChart } from './chart-rules.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { SHELL_ACTIONS } from './shell-actions.ts';
import { buildBackingTrack, clickSound, type PopupSounds } from './song.ts';

/** 用名字代替真正的 AudioBuffer，只检查排了哪些声音 */
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
} as unknown as PopupSounds;

/** 一个乐句，示范小节里按给定的拍位置放这些动作 */
function chartWith(events: [number, ActionType][]) {
  return buildChart(
    sourceFromPatterns([[0]], {
      phrases: [{ call: events.map(([beat, action]) => ({ beat, action })) }],
    }),
  );
}

describe('新动作的示范音', () => {
  const name = (s: { buffer: AudioBuffer }) => s.buffer as unknown as string;
  const cues = (events: [number, ActionType][]) =>
    buildBackingTrack(chartWith(events), sounds)
      .filter((s) => !['kick', 'snare', 'hat', 'count', 'countAccent'].includes(name(s)))
      .map((s) => `${s.beat}:${name(s)}`);

  it('气泡、程序窗口、文件在拍点上响出现的声音', () => {
    // 示范小节从第 4 拍开始
    expect(
      cues([
        [0, 'balloon-info'],
        [1, 'window-minimize'],
        [2, 'recycle-bin'],
      ]),
    ).toEqual(['4:balloon', '5:restore', '6:fileDrop']);
  });

  it('开始菜单示范两下：拍点上按「开始」，0.5 拍后点菜单项', () => {
    expect(cues([[1, 'start-menu']])).toEqual(['5:close', '5.5:menuCommand']);
  });
});

describe('新动作跟打命中的声音', () => {
  it('每种动作各有自己的声音', () => {
    expect(clickSound(sounds, 'balloon-info', 0)).toBe('navigate');
    expect(clickSound(sounds, 'window-minimize', 0)).toBe('minimize');
    expect(clickSound(sounds, 'recycle-bin', 0)).toBe('recycle');
    expect(clickSound(sounds, 'start-menu', 0)).toBe('close');
    expect(clickSound(sounds, 'start-menu', 1)).toBe('menuCommand');
  });
});

describe('每个乐句的上限', () => {
  const repeat = (action: ActionType, n: number): [number, ActionType][] =>
    Array.from({ length: n }, (_, i) => [i * 0.5, action]);

  it('上限以内没有错误', () => {
    expect(checkWindowsXpChart(chartWith(repeat('balloon-info', 3)))).toEqual([]);
    expect(checkWindowsXpChart(chartWith(repeat('window-minimize', 4)))).toEqual([]);
    expect(checkWindowsXpChart(chartWith(repeat('recycle-bin', 6)))).toEqual([]);
  });

  it('超过上限时报错', () => {
    expect(checkWindowsXpChart(chartWith(repeat('balloon-info', 4)))).toEqual([
      'phrases[0]：balloon-info 4 个，XP 场景每个乐句最多 3 个',
    ]);
    expect(checkWindowsXpChart(chartWith(repeat('window-minimize', 5)))).toEqual([
      'phrases[0]：window-minimize 5 个，XP 场景每个乐句最多 4 个',
    ]);
    expect(checkWindowsXpChart(chartWith(repeat('recycle-bin', 7)))).toEqual([
      'phrases[0]：recycle-bin 7 个，XP 场景每个乐句最多 6 个',
    ]);
  });

  it('消息框和程序窗口共用 6 个位置', () => {
    const events: [number, ActionType][] = [
      ...repeat('dialog-info', 4),
      [2, 'window-minimize'],
      [2.5, 'window-minimize'],
      [3, 'window-minimize'],
    ];
    expect(checkWindowsXpChart(chartWith(events))).toEqual([
      'phrases[0]：消息框和程序窗口合计 7 个，XP 场景每个乐句最多 6 个',
    ]);
  });
});
