// 等待与长按两个动作的判定（doc/scenes/windows-xp-levels.md「判定（暂定）」）。

import { describe, expect, it } from 'vite-plus/test';
import type { SceneContext } from '../../game/scene.ts';
import { buildChart } from '../../rhythm/chart.ts';
import { sourceFromPatterns } from '../../rhythm/test-charts.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { PopupSession } from './popup-session.ts';
import { buildBackingTrack, type PopupSounds } from './song.ts';

/** 用名字代替真正的 AudioBuffer */
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
} as unknown as PopupSounds;

function fakeContext() {
  const played: string[] = [];
  const scheduled: { name: string; when: number }[] = [];
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
          else scheduled.push({ name: source.buffer as string, when });
        },
      };
      return source;
    },
  };
  const context = { clock: { context: audio }, calibration: () => 0 };
  return { context: context as unknown as SceneContext, played, scheduled };
}

/** 一个乐句，示范小节第 beat 拍放一个 action；跟打小节相同 */
function chartWith(action: 'volume-mute' | 'progress-download', beat = 0) {
  return buildChart(sourceFromPatterns([[0]], { phrases: [{ call: [{ beat, action }] }] }));
}

describe('volume-mute：只判定按下', () => {
  it('拍点上按下命中：只记一次判定，1 拍后自动松开，预约 volumeRelease', () => {
    const { context, played, scheduled } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const state = session.windows[0]!;
    const [press, release] = state.clicks;

    const tapTime = session.timeAt(press!.beat) + 0.02;
    expect(session.tap(tapTime)?.level).toBe('perfect');
    expect(session.counts()).toEqual({ perfect: 1, good: 0, miss: 0 });
    expect(session.targetCount).toBe(1);
    const beat = 60 / session.chart.bpm;
    expect(release!.hitAt).toBeCloseTo(tapTime + beat);
    expect(state.closedAt).toBeCloseTo(tapTime + beat);
    expect(played).toEqual(['close']);
    expect(scheduled).toEqual([{ name: 'volumeRelease', when: 10 + beat }]);
  });

  it('按下之后不管什么时候松手、一直按着，都不再判定', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.windows[0]!.clicks;

    session.tap(session.timeAt(press!.beat));
    session.update(session.timeAt(release!.beat) + 1);
    expect(session.judgements).toHaveLength(1);
    expect(session.counts().miss).toBe(0);
  });

  it('按下 Miss：只记一次 Miss，不会自动松开', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.windows[0]!.clicks;

    session.update(session.timeAt(press!.beat) + 0.15);
    expect(session.counts()).toEqual({ perfect: 0, good: 0, miss: 1 });
    expect(release!.hitAt).toBeNull();
    expect(session.windows[0]!.closedAt).toBeNull();
    expect(played).toEqual(['miss']);
  });

  it('松开的拍点上按下不算：那里没有判定目标', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [, release] = session.windows[0]!.clicks;
    expect(session.tap(session.timeAt(release!.beat))).toBeNull();
  });
});

describe('progress-download：等进度条走满', () => {
  it('判定点在事件后 3 拍；走满那一拍点命中，响 downloadOpen', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('progress-download'), sounds);
    const state = session.windows[0]!;
    expect(state.clicks.map((c) => c.beat - state.response.beat)).toEqual([3]);

    // 刚弹出时点：离判定点很远，不计分（灰掉的按钮点了没反应）
    expect(session.tap(session.timeAt(state.response.beat))).toBeNull();
    expect(session.tap(session.timeAt(state.clicks[0]!.beat))?.level).toBe('perfect');
    expect(played).toEqual(['downloadOpen']);
  });

  it('伴奏：示范段弹出声 + 走满时点「Open」，跟打段只有弹出声', () => {
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
