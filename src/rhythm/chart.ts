// 谱面：示范 / 跟打的时间表。时间一律以拍为单位，第 0 拍是全曲第一拍（预备拍的开头）。

export interface ChartCue {
  /** 全曲拍位置 */
  beat: number;
  /** 属于第几个乐句（从 0 开始） */
  phrase: number;
  /** 乐句内的第几个动作（从 0 开始） */
  index: number;
}

export interface ChartPhrase {
  /** 示范小节开头的拍位置 */
  callStart: number;
  /** 跟打小节开头的拍位置 */
  responseStart: number;
  /** 跟打小节结束的拍位置 */
  end: number;
}

export interface Chart {
  bpm: number;
  beatsPerBar: number;
  phrases: ChartPhrase[];
  /** 示范动作，按时间排序 */
  calls: ChartCue[];
  /** 跟打目标，与 calls 一一对应（下标相同），按时间排序 */
  responses: ChartCue[];
  /** 全曲结束的拍位置 */
  endBeat: number;
}

export interface CallResponseOptions {
  bpm: number;
  beatsPerBar: number;
  /** 开头预备的小节数 */
  countInBars: number;
  /** 结尾留空的小节数 */
  outroBars: number;
  /** 每个乐句示范小节内的拍位置，例如 [0, 1, 2] */
  patterns: readonly (readonly number[])[];
}

/**
 * 生成「示范 1 小节 + 跟打 1 小节」的谱面：
 * 跟打目标与示范动作的相对位置相同，整体晚 1 小节。
 */
export function buildCallResponseChart(options: CallResponseOptions): Chart {
  const { bpm, beatsPerBar, countInBars, outroBars, patterns } = options;
  const phrases: ChartPhrase[] = [];
  const calls: ChartCue[] = [];
  const responses: ChartCue[] = [];

  patterns.forEach((pattern, phrase) => {
    validatePattern(pattern, beatsPerBar, phrase);
    const callStart = (countInBars + phrase * 2) * beatsPerBar;
    const responseStart = callStart + beatsPerBar;
    phrases.push({ callStart, responseStart, end: responseStart + beatsPerBar });
    pattern.forEach((offset, index) => {
      calls.push({ beat: callStart + offset, phrase, index });
      responses.push({ beat: responseStart + offset, phrase, index });
    });
  });

  const endBeat = (countInBars + patterns.length * 2 + outroBars) * beatsPerBar;
  return { bpm, beatsPerBar, phrases, calls, responses, endBeat };
}

function validatePattern(pattern: readonly number[], beatsPerBar: number, phrase: number): void {
  if (pattern.length === 0) {
    throw new RangeError(`第 ${phrase + 1} 个乐句没有动作`);
  }
  pattern.forEach((offset, i) => {
    if (!(offset >= 0 && offset < beatsPerBar)) {
      throw new RangeError(`第 ${phrase + 1} 个乐句的拍位置 ${offset} 超出小节`);
    }
    if (i > 0 && offset <= pattern[i - 1]!) {
      throw new RangeError(`第 ${phrase + 1} 个乐句的拍位置必须从小到大且不重复`);
    }
  });
}
