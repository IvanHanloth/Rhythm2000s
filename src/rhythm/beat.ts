// 拍 ↔ 音频时间换算。时间单位为秒，使用 AudioContext 时间轴。

/** 每拍的秒数。 */
export function secondsPerBeat(bpm: number): number {
  if (!(bpm > 0)) {
    throw new RangeError(`BPM 必须大于 0，收到 ${bpm}`);
  }
  return 60 / bpm;
}

/** 第 beat 拍的音频时间。startTime 是第 0 拍的时间。 */
export function beatToTime(startTime: number, bpm: number, beat: number): number {
  return startTime + beat * secondsPerBeat(bpm);
}

/** 某个音频时间对应的拍位置（可以是小数，也可以是负数）。 */
export function timeToBeat(startTime: number, bpm: number, time: number): number {
  return (time - startTime) / secondsPerBeat(bpm);
}

export interface NearestBeat {
  /** 最近的拍序号，不小于 0 */
  beat: number;
  /** 相对该拍的偏差（秒）；正数表示晚，负数表示早 */
  offset: number;
}

/** 找到离 time 最近的拍，并给出偏差。 */
export function nearestBeat(startTime: number, bpm: number, time: number): NearestBeat {
  const beat = Math.max(0, Math.round(timeToBeat(startTime, bpm, time)));
  return { beat, offset: time - beatToTime(startTime, bpm, beat) };
}
