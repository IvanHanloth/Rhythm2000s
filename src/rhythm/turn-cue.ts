// Turn cues: when Follow me (call bar) and Your turn (response bar) show (doc/prototypes/mvp.md).
// Times are in beats, like the chart.

import { secondsPerBeat } from './beat.ts';
import { lastTapOffset } from './actions.ts';
import type { Chart } from './chart.ts';

export type Turn = 'call' | 'response';

export interface TurnCue {
  turn: Turn;
  /** Phrase index */
  phrase: number;
  /** Beat where it starts showing */
  start: number;
  /** Beat where it stops showing (exclusive) */
  end: number;
}

/** How many beats before the switch the cue appears (provisional, MVP) */
export const TURN_CUE_LEAD_BEATS = 0.5;

/**
 * Two cues per phrase: Follow me from `lead` beats before the call bar; Your turn from `lead` beats before the call bar ends,
 * through the gap and into the response bar, so the player has time to get ready.
 * Your turn lasts until the phrase ends; if another phrase follows, it gives way to the next Follow me `lead` beats early.
 */
export function buildTurnCues(chart: Chart, lead = TURN_CUE_LEAD_BEATS): TurnCue[] {
  const cues: TurnCue[] = [];
  chart.phrases.forEach((phrase, i) => {
    const next = chart.phrases[i + 1];
    const handOver = next ? Math.min(phrase.end, next.callStart - lead) : phrase.end;
    cues.push(
      { turn: 'call', phrase: i, start: phrase.callStart - lead, end: phrase.callEnd - lead },
      { turn: 'response', phrase: i, start: phrase.callEnd - lead, end: handOver },
    );
  });
  return cues;
}

/** The cue to show on a beat; null outside every cue. */
export function turnCueAt(cues: readonly TurnCue[], beat: number): TurnCue | null {
  return cues.find((cue) => beat >= cue.start && beat < cue.end) ?? null;
}

/**
 * Checks that a chart works with the turn cues: every event's Good window must close before the cue switches,
 * otherwise the banner changes while the player is still pressing. Returns error messages; empty means fine.
 */
export function checkTurnCueSpacing(
  chart: Chart,
  goodWindowSeconds: number,
  lead = TURN_CUE_LEAD_BEATS,
): string[] {
  const goodBeats = goodWindowSeconds / secondsPerBeat(chart.bpm);
  const cues = buildTurnCues(chart, lead);
  const errors: string[] = [];

  for (const [turn, list, key] of [
    ['call', chart.calls, 'call'],
    ['response', chart.responses, 'response'],
  ] as const) {
    for (const cue of list) {
      const shown = cues.find((c) => c.turn === turn && c.phrase === cue.phrase);
      // Two-press actions go by the last press
      const lastTap = cue.beat + lastTapOffset(cue.action);
      if (!shown || lastTap + goodBeats < shown.end) continue;
      const barStart =
        turn === 'call'
          ? chart.phrases[cue.phrase]!.callStart
          : chart.phrases[cue.phrase]!.responseStart;
      const latest = shown.end - barStart - goodBeats - (lastTap - cue.beat);
      errors.push(
        `phrases[${cue.phrase}].${key}[${cue.index}]: beat ${cue.beat - barStart} is too late; ` +
          `the cue would switch before judging ends. At ${chart.bpm} BPM it must be before beat ${Number(latest.toFixed(2))}`,
      );
    }
  }
  return errors;
}
