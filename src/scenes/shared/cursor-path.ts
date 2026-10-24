// The virtual mouse's path (doc/scenes/windows-xp.md "Virtual mouse"): a list of stops, each a place
// to be at on a beat. Positions come from the beat alone, following the audio clock. No PixiJS, so it is testable.

import { secondsPerBeat } from '@/rhythm/beat.ts';
import { JUDGE_WINDOWS } from '@/rhythm/judge.ts';
import type { RoundSession, RoundTarget } from './round-session.ts';

export interface CursorStop {
  /** Be here on this beat (song beats) */
  beat: number;
  x: number;
  y: number;
  /** Earliest beat to leave; defaults to holdBeats after the stop */
  leave?: number;
}

export interface CursorPathOptions {
  /** How many beats early to arrive */
  leadBeats: number;
  /** Pause after a demonstrated press (beats) */
  holdBeats?: number;
  /** Longest move between stops (beats) */
  maxMoveBeats?: number;
  /** Shortest move when time is short (beats), so it never jumps */
  minMoveBeats?: number;
}

export interface Point {
  x: number;
  y: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Pointer position at a beat. `stops` is sorted by beat and not empty;
 * before the first stop it rests there, after the last it rests on the last.
 */
export function cursorAt(
  stops: readonly CursorStop[],
  beat: number,
  options: CursorPathOptions,
): Point {
  const { leadBeats, holdBeats = 1 / 16, maxMoveBeats = 0.5, minMoveBeats = 1 / 16 } = options;
  const first = stops[0];
  if (!first) throw new Error('The cursor path needs at least one stop');

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!;
    const to = stops[i]!;
    const leave = from.leave ?? from.beat + holdBeats;
    let end = to.beat - leadBeats;
    let start = Math.max(leave, end - maxMoveBeats);
    if (end - start < minMoveBeats) {
      start = leave;
      end = leave + minMoveBeats;
    }
    if (beat < start) return { x: from.x, y: from.y };
    if (beat < end) {
      const t = easeInOut((beat - start) / (end - start));
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
  }
  const last = stops.at(-1)!;
  return { x: last.x, y: last.y };
}

/** A phrase's last call press and first response press (song beats) */
export interface TurnGap {
  lastCall: number;
  firstResponse: number;
}

/** Minimum beats between them for the pointer to return to the centre in time */
export const RETURN_MIN_GAP_BEATS = 0.75;

/**
 * A stop at `center` halfway between each phrase's last call press and first response press: the pointer
 * returns after the call and sets off again in the response, so its first move tells the player it is their turn.
 * Phrases where the two are closer than RETURN_MIN_GAP_BEATS get none, to keep the pointer from darting about.
 */
export function returnToCenterStops(gaps: readonly TurnGap[], center: Point): CursorStop[] {
  return gaps
    .filter((gap) => gap.firstResponse - gap.lastCall >= RETURN_MIN_GAP_BEATS)
    .map((gap) => ({ beat: (gap.lastCall + gap.firstResponse) / 2, x: center.x, y: center.y }));
}

/** Each phrase's TurnGap, from the call and response beats of every press of its events */
export function turnGaps(
  events: readonly {
    phrase: number;
    callBeats: readonly number[];
    responseBeats: readonly number[];
  }[],
): TurnGap[] {
  const byPhrase = new Map<number, TurnGap>();
  for (const { phrase, callBeats, responseBeats } of events) {
    const gap = byPhrase.get(phrase) ?? { lastCall: -Infinity, firstResponse: Infinity };
    gap.lastCall = Math.max(gap.lastCall, ...callBeats);
    gap.firstResponse = Math.min(gap.firstResponse, ...responseBeats);
    byPhrase.set(phrase, gap);
  }
  return [...byPhrase.values()].filter(
    (gap) => Number.isFinite(gap.lastCall) && Number.isFinite(gap.firstResponse),
  );
}

/** Call or response */
export type Turn = 'call' | 'response';

/** Where each press of an event lands (virtual screen coordinates), one point per press; may differ between call and response */
export type PressPoints = (event: number, turn: Turn) => readonly Point[];

interface TrackStop {
  stop: CursorStop;
  /** Response stops wait until this press is judged before leaving */
  press?: { event: number; step: number };
}

/** Pause after a demonstrated press before moving on (beats) */
const HOLD_BEATS = 1 / 16;

/**
 * The virtual mouse's path through one round. In the call it demonstrates each press on its beat;
 * after the call it returns to `center`; in the response it arrives early at the next target,
 * presses in place when the player does, and leaves only once that press is judged.
 */
export class PointerTrack {
  /** How early the pointer arrives: the Good window plus 1/16 beat, so even the earliest valid press lands on target */
  readonly leadBeats: number;
  private readonly goodBeats: number;
  private readonly session: RoundSession;
  private readonly stops: TrackStop[];

  constructor(session: RoundSession, points: PressPoints, places: { home: Point; center: Point }) {
    this.session = session;
    this.goodBeats = JUDGE_WINDOWS.good / secondsPerBeat(session.chart.bpm);
    this.leadBeats = this.goodBeats + 1 / 16;

    const { home, center } = places;
    const stops: TrackStop[] = [{ stop: { beat: -Infinity, ...home } }];
    session.targets.forEach((target, event) => {
      const call = points(event, 'call');
      const response = points(event, 'response');
      target.clicks.forEach((click, step) => {
        stops.push({ stop: { beat: demoBeat(target, step), ...pressPoint(call, event, step) } });
        stops.push({
          stop: { beat: click.beat, ...pressPoint(response, event, step) },
          press: { event, step },
        });
      });
    });
    const gaps = turnGaps(
      session.targets.map((target) => ({
        phrase: target.call.phrase,
        callBeats: target.clicks.map((_, step) => demoBeat(target, step)),
        responseBeats: target.clicks.map((c) => c.beat),
      })),
    );
    for (const stop of returnToCenterStops(gaps, center)) stops.push({ stop });
    stops.push({ stop: { beat: session.chart.endBeat, ...home } });
    this.stops = stops.sort((a, b) => a.stop.beat - b.stop.beat);
  }

  /** Pointer position at a beat */
  positionAt(beat: number): Point {
    // A response stop is left once its press is judged, or when the Good window closes
    for (const { stop, press } of this.stops) {
      if (!press) continue;
      const click = this.session.targets[press.event]!.clicks[press.step]!;
      const done = click.hitAt ?? click.missedAt;
      stop.leave = done !== null ? this.session.beatAt(done) : stop.beat + this.goodBeats;
    }
    return cursorAt(
      this.stops.map((s) => s.stop),
      beat,
      { leadBeats: this.leadBeats, holdBeats: HOLD_BEATS },
    );
  }

  /** Beats at which the player's presses hit */
  hitBeats(): number[] {
    const beats: number[] = [];
    for (const target of this.session.targets) {
      for (const click of target.clicks) {
        if (click.hitAt !== null) beats.push(this.session.beatAt(click.hitAt));
      }
    }
    return beats;
  }
}

/** Beat of a target's step-th press as demonstrated in the call */
export function demoBeat(target: RoundTarget, step: number): number {
  return target.call.beat + (target.clicks[step]!.beat - target.response.beat);
}

function pressPoint(points: readonly Point[], event: number, step: number): Point {
  const point = points[step];
  if (!point) throw new Error(`No pointer position for press ${step} of event ${event}`);
  return point;
}
