// Rounds with the cheat code on (doc/cheat-code.md): every press is Perfect and unpressed targets are hit on their beat.

import { describe, expect, it } from 'vite-plus/test';
import { CheatMode } from '@/game/cheat.ts';
import { buildChart } from '@/rhythm/chart.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { pairTargets, RoundSession } from './round-session.ts';
import { fakeContext } from './test-audio.ts';

const sound = (name: string) => name as unknown as AudioBuffer;

function cheatRound(on: boolean) {
  const chart = buildChart(sourceFromPatterns([[0, 1, 2]], { bpm: 120 }));
  const cheat = new CheatMode();
  if (on) cheat.activate();
  const { context } = fakeContext(0, cheat);
  return new RoundSession(context, chart, {
    targets: pairTargets(chart),
    backingTrack: [],
    hitSound: () => sound('hit'),
    missSound: sound('miss'),
  });
}

function playThrough(session: RoundSession): void {
  for (let time = session.startTime; time < session.endTime; time += 0.02) session.update(time);
}

describe('RoundSession with the cheat code on', () => {
  it('hits unpressed targets on their beat and makes a Good press Perfect', () => {
    const session = cheatRound(true);
    const [first, second] = session.targets.map((t) => session.timeAt(t.response.beat));
    expect(session.tap(first! + 0.1)?.level).toBe('perfect');
    playThrough(session);
    expect(session.counts()).toEqual({ perfect: 3, good: 0, miss: 0 });
    expect(session.targets[1]!.handledAt).toBeCloseTo(second!, 1);
  });

  it('misses unpressed targets with the cheat off', () => {
    const session = cheatRound(false);
    playThrough(session);
    expect(session.counts().miss).toBe(3);
  });
});
