import { describe, expect, it } from 'vite-plus/test';
import type { SceneContext } from '../../game/scene.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { PopupSession } from './popup-session.ts';
import type { PopupSounds } from './song.ts';
import { buildChart } from '../../rhythm/chart.ts';
import { sourceFromPatterns } from '../../rhythm/test-charts.ts';
import { loadMvpChart } from './test-mvp-chart.ts';

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
    ].map((n) => [n, n]),
  ),
  dialogs: Object.fromEntries(Object.keys(DIALOG_KINDS).map((kind) => [kind, kind])),
} as unknown as PopupSounds;

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

  it('提前按：这一下记为 Miss，响提示音，消息框不关', () => {
    const { context, played } = fakeContext();
    const session = new PopupSession(context, loadMvpChart(), sounds);
    const target = session.timeAt(session.chart.responses[0]!.beat);

    expect(session.tap(target - 0.15)).toMatchObject({ event: 0, step: 0, level: 'miss' });
    expect(session.windows[0]!.missedAt).toBeCloseTo(target - 0.15, 10);
    expect(session.windows[0]!.closedAt).toBeNull();
    expect(session.tap(target)).toBeNull();
    expect(played).toEqual(['miss']);
  });

  it('一直连按通过不了：整局几乎全是 Miss', () => {
    const { context } = fakeContext();
    const session = new PopupSession(context, loadMvpChart(), sounds);
    for (let time = session.startTime; time < session.endTime; time += 0.05) {
      session.update(time);
      session.tap(time);
    }
    session.update(session.endTime);

    const counts = session.counts();
    expect(counts.perfect + counts.good + counts.miss).toBe(33);
    expect(counts.miss).toBeGreaterThan(30);
  });

  it('右键刷新要按两下：各自判定，第一下右键声、第二下菜单命令声，第二下命中才算完成', () => {
    const { context, played } = fakeContext();
    const chart = buildChart(
      sourceFromPatterns([[0]], {
        phrases: [
          {
            call: [
              { beat: 0, action: 'desktop-refresh' },
              { beat: 1, action: 'dialog-info' },
            ],
          },
        ],
      }),
    );
    const session = new PopupSession(context, chart, sounds);
    const [refresh, dialog] = session.windows;
    expect(refresh!.clicks.map((c) => c.beat)).toEqual([8, 8.5]);
    expect(dialog!.clicks.map((c) => c.beat)).toEqual([9]);

    // 第一下漏掉，第二下和消息框都踩准
    session.update(session.timeAt(8.5) - 0.001);
    expect(session.tap(session.timeAt(8.5))).toMatchObject({ event: 0, step: 1, target: 1 });
    expect(session.tap(session.timeAt(9))).toMatchObject({ event: 1, step: 0, target: 2 });

    expect(session.judgements.map((j) => [j.event, j.step, j.level])).toEqual([
      [0, 0, 'miss'],
      [0, 1, 'perfect'],
      [1, 0, 'perfect'],
    ]);
    expect(refresh!.missedAt).not.toBeNull();
    expect(refresh!.closedAt).toBeCloseTo(session.timeAt(8.5), 10);
    expect(played).toEqual(['miss', 'menuCommand', 'close']);
  });
});
