// Rounds that follow on from each other share one beat grid (doc/level-design.md "Resuming").

import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { pairTargets, ROUND_LEAD_IN, RoundSession } from './round-session.ts';
import { fakeContext } from './test-audio.ts';

const sound = (name: string) => name as unknown as AudioBuffer;

/** One phrase at 120 BPM (0.5 s a beat) with no outro, a click on every beat and a closing hit on the end beat */
function round(startTime?: number) {
  const chart = buildChart(sourceFromPatterns([[0]], { bpm: 120, outroBars: 0 }));
  const { context, scheduled } = fakeContext();
  const beats = Array.from({ length: chart.endBeat }, (_, beat) => ({
    beat,
    buffer: sound('beat'),
  }));
  const session = new RoundSession(context, chart, {
    targets: pairTargets(chart),
    backingTrack: [...beats, { beat: chart.endBeat, buffer: sound('end') }],
    hitSound: () => sound('hit'),
    missSound: sound('miss'),
    startTime,
  });
  const audio = context.clock.context as { currentTime: number };
  return { session, scheduled, audio };
}

describe('RoundSession start and hand-off', () => {
  it('starts ROUND_LEAD_IN from now by default, or at the time it is given', () => {
    expect(round().session.startTime).toBeCloseTo(10 + ROUND_LEAD_IN);
    expect(round(12.5).session.startTime).toBe(12.5);
  });

  it('a hand-off books the rest before the end beat at once and nothing from it on', () => {
    const { session, scheduled, audio } = round(10);
    audio.currentTime = session.endTime - 1.2;
    session.handOff();
    // The beats at 1.0 and 0.5 s before the end, with no update() after the hand-off
    expect(scheduled.map((s) => s.when)).toEqual([session.endTime - 1, session.endTime - 0.5]);
    for (; audio.currentTime < session.endTime + 0.5; audio.currentTime += 0.05) session.update(0);
    expect(scheduled.map((s) => s.name)).not.toContain('end');
    expect(Math.max(...scheduled.map((s) => s.when))).toBeLessThan(session.endTime);

    const next = round(session.endTime).session;
    expect(next.timeAt(0)).toBe(session.endTime);
  });
});
