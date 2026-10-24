// 谱面：把谱面文件（ChartSource）展开成游戏用的时间表。
// 时间一律以拍为单位，第 0 拍是全曲第一拍（预备拍的开头）。

import type { ActionType } from './actions.ts';
import type { ChartEventSource, ChartSource } from './chart-file.ts';

export interface ChartCue {
  /** 全曲拍位置 */
  beat: number;
  /** 属于第几个乐句（从 0 开始） */
  phrase: number;
  /** 在乐句的示范 / 跟打小节里是第几个事件（从 0 开始） */
  index: number;
  action: ActionType;
}

export interface ChartPhrase {
  /** 示范小节开头的拍位置 */
  callStart: number;
  /** 示范小节结束（空档开始）的拍位置 */
  callEnd: number;
  /** 跟打小节开头的拍位置（空档结束） */
  responseStart: number;
  /** 跟打小节结束的拍位置 */
  end: number;
}

export interface Chart {
  id: string;
  title: string;
  /** 所属场景 id */
  scene: string;
  bpm: number;
  beatsPerBar: number;
  phrases: ChartPhrase[];
  /** 示范事件，按时间排序 */
  calls: ChartCue[];
  /** 跟打目标（玩家要按的），按时间排序 */
  responses: ChartCue[];
  /** 全曲结束的拍位置 */
  endBeat: number;
}

/** 谱面没写 responseGapBeats 时，示范与跟打之间空几拍（2026-10-24 用户定为 0.5 拍） */
export const DEFAULT_RESPONSE_GAP_BEATS = 0.5;

/**
 * 展开谱面：每个乐句依次是示范小节、空档（responseGapBeats 拍）、跟打小节，乐句之间没有间隔；
 * 乐句没写 response 时，跟打与示范相同。输入应已通过 parseChartFile 校验。
 */
export function buildChart(source: ChartSource): Chart {
  const { beatsPerBar, countInBars, outroBars } = source;
  const defaultGap = source.responseGapBeats ?? DEFAULT_RESPONSE_GAP_BEATS;
  const phrases: ChartPhrase[] = [];
  const calls: ChartCue[] = [];
  const responses: ChartCue[] = [];

  const place = (events: readonly ChartEventSource[], barStart: number, phrase: number) =>
    events.map((event, index) => ({
      beat: barStart + event.beat,
      phrase,
      index,
      action: event.action,
    }));

  let cursor = countInBars * beatsPerBar;
  source.phrases.forEach((phrase, i) => {
    const callStart = cursor;
    const callEnd = callStart + beatsPerBar;
    const responseStart = callEnd + (phrase.responseGapBeats ?? defaultGap);
    const end = responseStart + beatsPerBar;
    phrases.push({ callStart, callEnd, responseStart, end });
    calls.push(...place(phrase.call, callStart, i));
    responses.push(...place(phrase.response ?? phrase.call, responseStart, i));
    cursor = end;
  });

  const endBeat = cursor + outroBars * beatsPerBar;
  return {
    id: source.id,
    title: source.title,
    scene: source.scene,
    bpm: source.bpm,
    beatsPerBar,
    phrases,
    calls,
    responses,
    endBeat,
  };
}
