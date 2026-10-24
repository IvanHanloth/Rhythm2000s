// Mac 第二批动作的判定：menu-volume 按下后自动松开、sheet-save 两下、ichat-message 的个数上限
// （doc/scenes/mac-2000.md「玩法」）。

import { describe, expect, it } from 'vite-plus/test';
import type { SceneContext } from '@/game/scene.ts';
import type { ActionType } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { checkMacChart } from './chart-rules.ts';
import { buildTargets, MacSession } from './session.ts';
import { buildBackingTrack, type MacSongSounds } from './song.ts';

/** 用名字代替真正的 AudioBuffer */
const names = ['kick', 'snare', 'hat', 'countAccent', 'count', 'handled', 'miss', 'result'];
const sounds = {
  ...Object.fromEntries(names.map((n) => [n, n])),
  actions: new Proxy({}, { get: (_, action) => action }),
  byName: new Proxy({}, { get: (_, name) => `sound:${String(name)}` }),
} as unknown as MacSongSounds;

function fakeContext() {
  const played: string[] = [];
  /** 预约在以后某个时间播放的声音 */
  const scheduled: string[] = [];
  const audio = {
    currentTime: 10,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        connect() {},
        stop() {},
        start(when?: number) {
          if (when === undefined) played.push(source.buffer as string);
          else scheduled.push(source.buffer as string);
        },
      };
      return source;
    },
  };
  const context = { clock: { context: audio }, calibration: () => 0 };
  return { context: context as unknown as SceneContext, played, scheduled };
}

/** 每个乐句一组 [拍, 动作] */
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

describe('menu-volume：只判按下，1 拍后自动松开', () => {
  it('按下命中：只判一下，松开由游戏在 1 拍后完成，响 Tink、预约 Pop', () => {
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
    expect(scheduled).toEqual(['sound:Pop']);
  });

  it('按下 Miss：只算一个 Miss，松开不再判', () => {
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
  it('按两下，相隔 0.5 拍；示范段第二下在拍点上响 Tink', () => {
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

  it('和提示框、文稿窗口共用 6 个位置', () => {
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
  it('同一乐句超过 3 个时报错', () => {
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
