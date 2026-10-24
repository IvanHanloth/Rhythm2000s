import { describe, expect, it } from 'vite-plus/test';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { XpSession } from './session.ts';
import type { XpSongSounds } from './song.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { loadMvpChart } from './test-mvp-chart.ts';
import { fakeContext } from '@/scenes/shared/test-audio.ts';

/** Sounds named by strings in place of real AudioBuffers */
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
} as unknown as XpSongSounds;

describe('XpSession', () => {
  it('hits every response but one: the rest are Perfect, the skipped one a Miss', () => {
    const { context, played } = fakeContext();
    const session = new XpSession(context, loadMvpChart(), sounds);
    const skipped = 4;

    session.chart.responses.forEach((cue, i) => {
      const time = session.timeAt(cue.beat);
      session.update(time);
      if (i !== skipped) session.tap(time);
    });
    session.update(session.endTime);

    expect(session.counts()).toEqual({ perfect: 32, good: 0, miss: 1 });
    expect(session.targets[skipped]!.missedAt).not.toBeNull();
    expect(session.targets[skipped]!.handledAt).toBeNull();
    expect(played.filter((s) => s === 'close')).toHaveLength(32);
    expect(played.filter((s) => s === 'miss')).toHaveLength(1);
  });

  it('subtracts the calibration before judging; the close time on screen stays the heard time', () => {
    const { context } = fakeContext(0.08);
    const session = new XpSession(context, loadMvpChart(), sounds);
    const target = session.timeAt(session.chart.responses[0]!.beat);

    // A player who habitually presses 80 ms late: an input heard 80 ms late is Perfect
    expect(session.tap(target + 0.08)?.level).toBe('perfect');
    expect(session.targets[0]!.handledAt).toBeCloseTo(target + 0.08, 10);
  });

  it('ignores input with no target nearby', () => {
    const { context, played } = fakeContext();
    const session = new XpSession(context, loadMvpChart(), sounds);

    expect(session.tap(session.timeAt(0))).toBeNull();
    expect(session.judgements).toHaveLength(0);
    expect(played).toHaveLength(0);
  });

  it('an early press is a Miss with the miss sound, and the box stays open', () => {
    const { context, played } = fakeContext();
    const session = new XpSession(context, loadMvpChart(), sounds);
    const target = session.timeAt(session.chart.responses[0]!.beat);

    expect(session.tap(target - 0.15)).toMatchObject({ event: 0, step: 0, level: 'miss' });
    expect(session.targets[0]!.missedAt).toBeCloseTo(target - 0.15, 10);
    expect(session.targets[0]!.handledAt).toBeNull();
    expect(session.tap(target)).toBeNull();
    expect(played).toEqual(['miss']);
  });

  it('mashing does not pass: nearly every target is a Miss', () => {
    const { context } = fakeContext();
    const session = new XpSession(context, loadMvpChart(), sounds);
    for (let time = session.startTime; time < session.endTime; time += 0.05) {
      session.update(time);
      session.tap(time);
    }
    session.update(session.endTime);

    const counts = session.counts();
    expect(counts.perfect + counts.good + counts.miss).toBe(33);
    expect(counts.miss).toBeGreaterThan(30);
  });

  it('desktop-refresh takes two presses, judged separately, with right-click then menu sounds; done when the second hits', () => {
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
    const session = new XpSession(context, chart, sounds);
    const [refresh, dialog] = session.targets;
    expect(refresh!.clicks.map((c) => c.beat)).toEqual([8, 8.5]);
    expect(dialog!.clicks.map((c) => c.beat)).toEqual([9]);

    // Miss the first press, hit the second and the message box
    session.update(session.timeAt(8.5) - 0.001);
    expect(session.tap(session.timeAt(8.5))).toMatchObject({ event: 0, step: 1, target: 1 });
    expect(session.tap(session.timeAt(9))).toMatchObject({ event: 1, step: 0, target: 2 });

    expect(session.judgements.map((j) => [j.event, j.step, j.level])).toEqual([
      [0, 0, 'miss'],
      [0, 1, 'perfect'],
      [1, 0, 'perfect'],
    ]);
    expect(refresh!.missedAt).not.toBeNull();
    expect(refresh!.handledAt).toBeCloseTo(session.timeAt(8.5), 10);
    expect(played).toEqual(['miss', 'menuCommand', 'close']);
  });
});
