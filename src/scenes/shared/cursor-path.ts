// 虚拟鼠标的移动轨迹（doc/scenes/windows-xp.md「虚拟鼠标」）。
// 轨迹由一串「停靠点」决定：在某一拍要停在某个位置。位置只由拍算出来，跟着音频时钟走，不累加帧间隔。
// 不依赖 PixiJS，便于测试。

import { secondsPerBeat } from '../../rhythm/beat.ts';
import { JUDGE_WINDOWS } from '../../rhythm/judge.ts';
import type { RoundSession, RoundTarget } from './round-session.ts';

export interface CursorStop {
  /** 要在这一拍停在这里（全曲拍） */
  beat: number;
  x: number;
  y: number;
  /** 最早什么时候离开（拍）；不写时拍点后 holdBeats 离开 */
  leave?: number;
}

export interface CursorPathOptions {
  /** 提前多少拍到位 */
  leadBeats: number;
  /** 示范段点完以后停多久再走（拍） */
  holdBeats?: number;
  /** 两个停靠点之间最多用多久移过去（拍） */
  maxMoveBeats?: number;
  /** 时间不够时，最少也要用这么久移过去（拍），免得瞬移 */
  minMoveBeats?: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 慢进慢出 */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * 虚拟鼠标在某一拍的位置。stops 按 beat 从小到大排列，至少一个。
 * 第一个停靠点之前停在第一个停靠点上；最后一个之后停在最后一个上。
 */
export function cursorAt(
  stops: readonly CursorStop[],
  beat: number,
  options: CursorPathOptions,
): Point {
  const { leadBeats, holdBeats = 1 / 16, maxMoveBeats = 0.5, minMoveBeats = 1 / 16 } = options;
  const first = stops[0];
  if (!first) throw new Error('虚拟鼠标至少要有一个停靠点');

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

/** 一个乐句里示范段的最后一下、跟打段的第一下（全曲拍） */
export interface TurnGap {
  lastCall: number;
  firstResponse: number;
}

/** 示范段最后一下和跟打段第一下至少相隔多少拍，才来得及回中央再出发 */
export const RETURN_MIN_GAP_BEATS = 0.75;

/**
 * 示范完回到屏幕中央（2026-10-24 用户要求）：每个乐句在示范段最后一下和跟打段第一下的正中间，
 * 加一个停在 center 的停靠点。鼠标示范完先回中央，到跟打段再出发去目标，玩家看它一动就知道轮到自己了。
 * 两者相隔不到 RETURN_MIN_GAP_BEATS 拍的乐句不加，免得鼠标来回乱窜。
 */
export function returnToCenterStops(gaps: readonly TurnGap[], center: Point): CursorStop[] {
  return gaps
    .filter((gap) => gap.firstResponse - gap.lastCall >= RETURN_MIN_GAP_BEATS)
    .map((gap) => ({ beat: (gap.lastCall + gap.firstResponse) / 2, x: center.x, y: center.y }));
}

/** 按乐句汇总每个事件示范段、跟打段每一下的拍位置，得到每个乐句的 TurnGap */
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
