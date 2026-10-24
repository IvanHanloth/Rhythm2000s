// Beat guide timing (doc/beat-guide.md): which beats to press, how far each pair of arcs is from its beat,
// and how big the centre dot pulses. The volume actions are held from the press until the game releases them,
// drawn as a yellow bar. Beats only; the view is src/ui/beat-guide-view.ts.

import { actionTapKind, actionTapOffsets } from './actions.ts';
import type { Chart } from './chart.ts';

/** How many beats ahead the arcs appear at the edges */
export const GUIDE_LOOKAHEAD_BEATS = 4;
/** How long the arcs linger after their beat (beats) */
export const GUIDE_FADE_BEATS = 0.25;
/** How long the centre dot takes to shrink back after a beat (beats) */
export const GUIDE_PULSE_BEATS = 0.25;

/** Beat positions closer than this are the same beat (off-beats are at 1/8 beat at the finest) */
const SAME_BEAT = 1e-6;

/**
 * Beats the player presses (song beats), ascending and unique: every judged press of every response;
 * presses the game completes itself are left out.
 */
export function pressBeats(chart: Chart): number[] {
  const beats: number[] = [];
  for (const response of chart.responses) {
    actionTapOffsets(response.action).forEach((offset, step) => {
      if (actionTapKind(response.action, step) !== 'auto') beats.push(response.beat + offset);
    });
  }
  beats.sort((a, b) => a - b);
  return beats.filter((beat, i) => i === 0 || beat - beats[i - 1]! > SAME_BEAT);
}

/** A hold, from the press beat to the release beat (song beats) */
export interface HoldSpan {
  start: number;
  end: number;
}

/**
 * Holds sorted by start: a press followed by presses the game completes, held until the last of them.
 * Only the volume actions hold at the moment.
 */
export function holdSpans(chart: Chart): HoldSpan[] {
  const spans: HoldSpan[] = [];
  for (const response of chart.responses) {
    const offsets = actionTapOffsets(response.action);
    offsets.forEach((offset, step) => {
      if (actionTapKind(response.action, step) !== 'press') return;
      let last = step;
      while (last + 1 < offsets.length && actionTapKind(response.action, last + 1) !== 'press') {
        last++;
      }
      if (last > step) {
        spans.push({ start: response.beat + offset, end: response.beat + offsets[last]! });
      }
    });
  }
  return spans.sort((a, b) => a.start - b.start);
}

export interface GuideHold {
  /** Beats from now to each end of the bar, clamped to [0, GUIDE_LOOKAHEAD_BEATS]; `from` is 0 while held */
  from: number;
  to: number;
  /** The hold is under way (the dot stays yellow inside a yellow ring) */
  active: boolean;
}

/** Hold bars to draw at a beat: not yet over, and started within the lookahead */
export function guideHolds(beat: number, spans: readonly HoldSpan[]): GuideHold[] {
  return spans
    .filter((span) => span.end >= beat && span.start <= beat + GUIDE_LOOKAHEAD_BEATS)
    .map((span) => ({
      from: Math.max(0, span.start - beat),
      to: Math.min(GUIDE_LOOKAHEAD_BEATS, span.end - beat),
      active: beat >= span.start,
    }));
}

export interface GuideMark {
  /** Beats until the beat: positive ahead, 0 on it, negative just past (fading) */
  distance: number;
  /** A beat to press (drawn yellow) */
  press: boolean;
  /** The end of a hold (drawn as a thinner yellow arc) */
  holdEnd: boolean;
}

/**
 * Arc pairs to draw at a beat: every whole beat from 0 to endBeat, plus off-beat presses and hold ends,
 * limited to distances in [-GUIDE_FADE_BEATS, GUIDE_LOOKAHEAD_BEATS] and sorted by distance.
 * `presses` must be ascending (as from pressBeats); `holds` (from holdSpans) marks the hold ends.
 */
export function guideMarks(
  beat: number,
  endBeat: number,
  presses: readonly number[],
  holds: readonly HoldSpan[] = [],
): GuideMark[] {
  const from = beat - GUIDE_FADE_BEATS;
  const to = beat + GUIDE_LOOKAHEAD_BEATS;
  const marks: GuideMark[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= SAME_BEAT;
  const isPress = (b: number) => presses.some((p) => near(p, b));
  const isHoldEnd = (b: number) => holds.some((h) => near(h.end, b));
  const onBeat = (b: number) => near(b, Math.round(b));

  for (let b = Math.max(0, Math.ceil(from)); b <= Math.min(endBeat, to); b++) {
    const press = isPress(b);
    marks.push({ distance: b - beat, press, holdEnd: !press && isHoldEnd(b) });
  }
  // Off-beat presses and hold ends get their own pair of arcs
  const offBeat = [...presses, ...holds.map((h) => h.end)].filter((b) => !onBeat(b));
  offBeat.sort((a, b) => a - b);
  offBeat.forEach((b, i) => {
    if (b < from || b > to || (i > 0 && near(b, offBeat[i - 1]!))) return;
    const press = isPress(b);
    marks.push({ distance: b - beat, press, holdEnd: !press });
  });
  return marks.sort((a, b) => a.distance - b.distance);
}

/**
 * Centre dot pulse: 1 on a beat, shrinking linearly to 0 over GUIDE_PULSE_BEATS; 0 before beat 0.
 * `press` is true right after a press beat or during a hold (the dot turns yellow).
 */
export function guidePulse(
  beat: number,
  presses: readonly number[],
  holds: readonly HoldSpan[] = [],
): { strength: number; press: boolean } {
  if (beat < 0) return { strength: 0, press: false };
  const sinceBeat = beat - Math.floor(beat);
  // The latest press beat already reached (may be off the beat)
  let lastPress = -Infinity;
  for (const p of presses) {
    if (p > beat + SAME_BEAT) break;
    lastPress = p;
  }
  const sincePress = beat - lastPress;
  const since = Math.min(sinceBeat, sincePress);
  const strength = Math.max(0, 1 - since / GUIDE_PULSE_BEATS);
  const holding = holds.some((h) => beat >= h.start && beat <= h.end);
  return { strength, press: holding || sincePress < GUIDE_PULSE_BEATS };
}
