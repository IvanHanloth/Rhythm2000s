// 轮次提示：Follow me（示范小节）/ Your turn（跟打小节）什么时候显示（doc/prototypes/mvp.md）。
// 时间以拍为单位，和谱面一致。

import { secondsPerBeat } from './beat.ts';
import type { Chart } from './chart.ts';

export type Turn = 'call' | 'response';

export interface TurnCue {
  turn: Turn;
  /** 属于第几个乐句 */
  phrase: number;
  /** 开始显示的拍位置 */
  start: number;
  /** 停止显示的拍位置（不含） */
  end: number;
}

/** 提示比小节开头提前多少拍切换（MVP 暂定） */
export const TURN_CUE_LEAD_BEATS = 0.5;

/**
 * 每个乐句两条提示：示范小节开头前 lead 拍显示 Follow me，跟打小节开头前 lead 拍换成 Your turn。
 * Your turn 显示到乐句结束；紧接着有下一个乐句时，提前 lead 拍让位给下一个 Follow me。
 */
export function buildTurnCues(chart: Chart, lead = TURN_CUE_LEAD_BEATS): TurnCue[] {
  const cues: TurnCue[] = [];
  chart.phrases.forEach((phrase, i) => {
    const next = chart.phrases[i + 1];
    const handOver = next ? Math.min(phrase.end, next.callStart - lead) : phrase.end;
    cues.push(
      { turn: 'call', phrase: i, start: phrase.callStart - lead, end: phrase.responseStart - lead },
      { turn: 'response', phrase: i, start: phrase.responseStart - lead, end: handOver },
    );
  });
  return cues;
}

/** 某一拍应显示的提示；不在任何提示的时间段内时返回 null。 */
export function turnCueAt(cues: readonly TurnCue[], beat: number): TurnCue | null {
  return cues.find((cue) => beat >= cue.start && beat < cue.end) ?? null;
}

/**
 * 检查谱面能否配合轮次提示：每个事件的 Good 判定窗口必须在提示切走之前关闭，
 * 否则玩家还在按，横幅就已经换了。返回错误说明，空数组表示没问题。
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
      if (!shown || cue.beat + goodBeats < shown.end) continue;
      const barStart =
        turn === 'call'
          ? chart.phrases[cue.phrase]!.callStart
          : chart.phrases[cue.phrase]!.responseStart;
      const latest = shown.end - barStart - goodBeats;
      errors.push(
        `phrases[${cue.phrase}].${key}[${cue.index}]：第 ${cue.beat - barStart} 拍太靠后，` +
          `提示会在判定结束前切走；${chart.bpm} BPM 下要早于第 ${Number(latest.toFixed(2))} 拍`,
      );
    }
  }
  return errors;
}
