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
        },
      };
      return source;
    },
  };
  const context = { clock: { context: audio }, calibration: () => 0 };
  return { context: context as unknown as SceneContext, played };
}

/** 一个乐句，示范小节第 beat 拍放一个 action；跟打小节相同 */
function chartWith(action: 'volume-mute' | 'progress-download', beat = 0) {
  return buildChart(sourceFromPatterns([[0]], { phrases: [{ call: [{ beat, action }] }] }));
}

describe('volume-mute：长按', () => {
  it('拍点上按下、1 拍后松开：两下都命中，按下是点击声、松开是 volumeRelease', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.windows[0]!.clicks;

    expect(session.tap(session.timeAt(press!.beat))?.level).toBe('perfect');
    expect(session.heldEvent).toBe(0);
    expect(session.release(session.timeAt(release!.beat) + 0.03)?.level).toBe('perfect');
    expect(session.heldEvent).toBeNull();
    expect(session.windows[0]!.closedAt).not.toBeNull();
    expect(session.counts()).toEqual({ perfect: 2, good: 0, miss: 0 });
    expect(played).toEqual(['close', 'volumeRelease']);
  });

  it('松早了：松开这一下算 Miss', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.windows[0]!.clicks;

    session.tap(session.timeAt(press!.beat));
    expect(session.release(session.timeAt(release!.beat) - 0.3)).toMatchObject({
      step: 1,
      level: 'miss',
    });
    expect(session.windows[0]!.closedAt).toBeNull();
    expect(played).toEqual(['close', 'miss']);
  });

  it('一直按着不松：松开窗口关闭时算 Miss，之后再松开不计', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press, release] = session.windows[0]!.clicks;

    session.tap(session.timeAt(press!.beat));
    session.update(session.timeAt(release!.beat) + 0.15);
    expect(session.counts()).toEqual({ perfect: 1, good: 0, miss: 1 });
    expect(session.heldEvent).toBeNull();
    expect(session.release(session.timeAt(release!.beat) + 0.2)).toBeNull();
  });

  it('按下 Miss：松开也跟着算 Miss，只响一次 Miss', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [press] = session.windows[0]!.clicks;

    session.update(session.timeAt(press!.beat) + 0.15);
    expect(session.counts()).toEqual({ perfect: 0, good: 0, miss: 2 });
    expect(played).toEqual(['miss']);
  });

  it('没在按住时的松开（普通点击之后）忽略', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    expect(session.release(session.timeAt(session.windows[0]!.clicks[1]!.beat))).toBeNull();
    expect(session.judgements).toHaveLength(0);
  });

  it('松开不会被当成按下：按下目标不会被松开时间对上', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, chartWith('volume-mute'), sounds);
    const [, release] = session.windows[0]!.clicks;
    // 在松开的拍点上「按下」：没有按下目标在附近，不计分
    expect(session.tap(session.timeAt(release!.beat))).toBeNull();
  });
});

describe('progress-download：等进度条走满', () => {
  it('判定点在事件后 2 拍；走满那一拍点命中，响 downloadOpen', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, chartWith('progress-download'), sounds);
    const state = session.windows[0]!;
    expect(state.clicks.map((c) => c.beat - state.response.beat)).toEqual([2]);

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
    expect(at('downloadOpen')).toEqual([call + 2]);
  });
});
