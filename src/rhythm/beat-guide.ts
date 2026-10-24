// 律动组件（Beat Guide，doc/beat-guide.md）的时间计算：哪些拍要按、某一时刻每对弧离拍点还有几拍、中间的圆跳到多大。
// 音量动作（volume-mute、menu-volume）按下后要一直按住到游戏自动松开，算一段「按住」，画成黄色长条，和普通节拍区分开。
// 只算拍，不管画面；画面在 src/ui/beat-guide-view.ts。

import { actionTapKind, actionTapOffsets } from './actions.ts';
import type { Chart } from './chart.ts';

/** 弧提前几拍从两端出现 */
export const GUIDE_LOOKAHEAD_BEATS = 4;
/** 过了拍点之后，弧再留多久淡掉（拍） */
export const GUIDE_FADE_BEATS = 0.25;
/** 中间的圆在拍点放到最大，多少拍内缩回 */
export const GUIDE_PULSE_BEATS = 0.25;

/** 两个拍位置差在这之内算同一拍（反拍按 1/8 拍记，不会这么近） */
const SAME_BEAT = 1e-6;

/**
 * 玩家要按的拍位置（全曲拍），从小到大、不重复。
 * 每个跟打事件的每一下都算（长按的松开也算），游戏自己完成的 auto 各下不算。
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

/** 一段按住：从按下的拍到松开的拍（全曲拍） */
export interface HoldSpan {
  start: number;
  end: number;
}

/**
 * 要按住的各段，按开始的拍排好：一下 press 后面紧跟着的 auto / release 各下，一直按住到最后一下。
 * 目前只有音量动作（第二下由游戏 1 拍后自动完成）。
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
  /** 长条两头离现在还有几拍，已截到 [0, GUIDE_LOOKAHEAD_BEATS]：按住期间 from 是 0，长条连着中间的圆 */
  from: number;
  to: number;
  /** 现在正处在这一段里（中间的圆保持黄色、外面套一圈黄圈） */
  active: boolean;
}

/** beat 时刻要画的按住长条：还没结束、并且开头已经进了提前量的各段 */
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
  /** 离拍点还有几拍：正数是还没到，0 是正好在拍点，负数是刚过（正在淡掉） */
  distance: number;
  /** 这一拍玩家要按（画成黄色） */
  press: boolean;
  /** 这一拍是一段按住的结束（画成细一些的黄色弧，和要按的拍区分开） */
  holdEnd: boolean;
}

/**
 * beat 时刻要画的各对弧：第 0 拍到 endBeat 的每一整拍，加上不在整拍上的要按的点。
 * 只返回 distance 在 [-GUIDE_FADE_BEATS, GUIDE_LOOKAHEAD_BEATS] 内的，按 distance 从小到大排。
 * presses 须从小到大排好（pressBeats 的返回值）；holds 是按住的各段（holdSpans），用来标出结束的拍。
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
  // 不在整拍上的要按的点、按住的结束，单独加一对弧
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
 * 中间的圆这一刻跳得多大：拍点时为 1，GUIDE_PULSE_BEATS 内线性缩回 0；第 0 拍以前为 0。
 * press 表示最近的这一下是要按的点，或正在按住（圆显示成黄色）。
 */
export function guidePulse(
  beat: number,
  presses: readonly number[],
  holds: readonly HoldSpan[] = [],
): { strength: number; press: boolean } {
  if (beat < 0) return { strength: 0, press: false };
  const sinceBeat = beat - Math.floor(beat);
  // 最近一个已经到了的要按的点（可能在反拍上）
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
