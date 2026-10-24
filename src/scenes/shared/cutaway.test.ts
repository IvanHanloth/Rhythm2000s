// When chair-swivel's 3D cutaway runs (doc/cross-dimension.md).

import { describe, expect, it } from 'vite-plus/test';
import { CHAIR_SWIVEL_BEATS } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { JUDGE_WINDOWS } from '@/rhythm/judge.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { cutawayDesktopAlpha, cutawayProgress, hasCutaway } from './cutaway.ts';
import { pairTargets, RoundSession } from './round-session.ts';
import { fakeContext } from './test-audio.ts';

/** One phrase: chair-swivel on beat 1 of the call bar, repeated in the response */
function swivelRound() {
  const chart = buildChart(
    sourceFromPatterns([[0]], { phrases: [{ call: [{ beat: 1, action: 'chair-swivel' }] }] }),
  );
  const { context, played, scheduled } = fakeContext();
  const sound = 'sound' as unknown as AudioBuffer;
  const session = new RoundSession(context, chart, {
    targets: pairTargets(chart),
    backingTrack: [],
    hitSound: () => sound,
    missSound: sound,
  });
  return { session, played, scheduled };
}

describe('chair-swivel cutaway', () => {
  it('runs for CHAIR_SWIVEL_BEATS from the call beat', () => {
    const { session } = swivelRound();
    const callBeat = session.targets[0]!.call.beat;
    expect(hasCutaway(session.chart)).toBe(true);
    expect(cutawayProgress(session, callBeat - 0.01)).toBeNull();
    expect(cutawayProgress(session, callBeat)).toBe(0);
    expect(cutawayProgress(session, callBeat + CHAIR_SWIVEL_BEATS / 2)).toBeCloseTo(0.5);
    expect(cutawayProgress(session, callBeat + CHAIR_SWIVEL_BEATS)).toBeNull();
  });

  it('in the response it starts from the hit, not the target beat', () => {
    const { session } = swivelRound();
    const press = session.targets[0]!.clicks[0]!;
    expect(cutawayProgress(session, press.beat + 0.5)).toBeNull();

    // Late enough to miss Perfect, early enough for Good
    const late = session.timeAt(press.beat) + (JUDGE_WINDOWS.perfect + JUDGE_WINDOWS.good) / 2;
    expect(session.tap(late)?.level).toBe('good');
    const hitBeat = session.beatAt(late);
    expect(cutawayProgress(session, hitBeat)).toBe(0);
    expect(cutawayProgress(session, hitBeat + 1)).toBeCloseTo(1 / CHAIR_SWIVEL_BEATS);
  });

  it('only the press is judged; the landing completes by itself', () => {
    const { session, scheduled } = swivelRound();
    const press = session.targets[0]!.clicks[0]!;
    session.tap(session.timeAt(press.beat));
    session.update(session.timeAt(press.beat + CHAIR_SWIVEL_BEATS) + 1);
    expect(session.targetCount).toBe(1);
    expect(session.counts()).toEqual({ perfect: 1, good: 0, miss: 0 });
    expect(scheduled).toHaveLength(1);
  });

  it('a Miss stays in 2D', () => {
    const { session } = swivelRound();
    const press = session.targets[0]!.clicks[0]!;
    session.update(session.timeAt(press.beat) + 0.15);
    expect(session.counts().miss).toBe(1);
    expect(cutawayProgress(session, press.beat + 0.5)).toBeNull();
  });
});

describe('cutawayDesktopAlpha', () => {
  it('fades the desktop out at the start and back in at the end', () => {
    expect(cutawayDesktopAlpha(0)).toBe(1);
    expect(cutawayDesktopAlpha(1 / 32)).toBeCloseTo(0.5);
    expect(cutawayDesktopAlpha(0.5)).toBe(0);
    expect(cutawayDesktopAlpha(1 - 1 / 32)).toBeCloseTo(0.5);
    expect(cutawayDesktopAlpha(1)).toBe(1);
  });
});
