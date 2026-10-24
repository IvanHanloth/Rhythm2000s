import { describe, expect, it } from 'vite-plus/test';
import type { SceneContext } from '../../game/scene.ts';
import { PopupSession } from './popup-session.ts';
import type { PopupSounds } from './song.ts';
import { loadMvpChart } from './test-mvp-chart.ts';

/** 用名字代替真正的 AudioBuffer */
const sounds = Object.fromEntries(
  ['kick', 'snare', 'hat', 'countAccent', 'count', 'popup', 'close', 'miss'].map((n) => [n, n]),
) as unknown as PopupSounds;

/** 假的 AudioContext：只记录「立即播放」的音效，时间由测试手动推进。 */
function fakeContext(calibration = 0) {
  const played: string[] = [];
  const audio = {
    currentTime: 10,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        onended: null,
        connect() {},
        stop() {},
        start(when?: number) {
          if (when === undefined) played.push(source.buffer as string);
        },
      };
      return source;
    },
  };
  const context = { clock: { context: audio }, calibration: () => calibration };
  return { context: context as unknown as SceneContext, played };
}

describe('PopupSession', () => {
  it('跟打全部踩准、漏掉一个：其余都是 Perfect，漏掉的记为 Miss', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, loadMvpChart(), sounds);
    const skipped = 4;

    session.chart.responses.forEach((cue, i) => {
      const time = session.timeAt(cue.beat);
      session.update(time);
      if (i !== skipped) session.tap(time);
    });
    session.update(session.endTime);

    expect(session.counts()).toEqual({ perfect: 32, good: 0, miss: 1 });
    expect(session.windows[skipped]!.missedAt).not.toBeNull();
    expect(session.windows[skipped]!.closedAt).toBeNull();
    expect(played.filter((s) => s === 'close')).toHaveLength(32);
    expect(played.filter((s) => s === 'miss')).toHaveLength(1);
  });

  it('判定前扣除校准值；画面上的关闭时间仍用听到的时间', () => {
    const { context } = fakeContext(0.08);
    const session = new PopupSession(context, loadMvpChart(), sounds);
    const target = session.timeAt(session.chart.responses[0]!.beat);

    // 玩家习惯晚 80 毫秒：听感上晚 80 毫秒的输入应判为 Perfect
    expect(session.tap(target + 0.08)?.level).toBe('perfect');
    expect(session.windows[0]!.closedAt).toBeCloseTo(target + 0.08, 10);
  });

  it('附近没有目标的输入不计分', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, loadMvpChart(), sounds);

    expect(session.tap(session.timeAt(0))).toBeNull();
    expect(session.judgements).toHaveLength(0);
    expect(played).toHaveLength(0);
  });
});
