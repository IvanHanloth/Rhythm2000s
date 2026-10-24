// 把输入事件时间（performance.now() 时间轴，毫秒）换算成
// 「那一刻扬声器正在播放的音频时间」（AudioContext 时间轴，秒）。
// 两种方法的说明见 doc/prototypes/latency-test.md。

export interface OutputStamp {
  /** 正在从扬声器输出的音频时间（秒） */
  contextTime: number;
  /** 这段音频输出的时刻（performance.now() 时间轴，毫秒） */
  performanceTime: number;
}

/** getOutputTimestamp() 的结果是否可用。音频还没开始流动时，浏览器会返回 0。 */
export function isUsableStamp(
  stamp: { contextTime?: number; performanceTime?: number } | null | undefined,
): stamp is OutputStamp {
  return (
    stamp != null &&
    Number.isFinite(stamp.contextTime) &&
    Number.isFinite(stamp.performanceTime) &&
    (stamp.contextTime ?? 0) > 0 &&
    (stamp.performanceTime ?? 0) > 0
  );
}

/** 方法 A：用 getOutputTimestamp() 的时间对做线性换算。 */
export function heardTimeFromStamp(stamp: OutputStamp, eventPerfMs: number): number {
  return stamp.contextTime + (eventPerfMs - stamp.performanceTime) / 1000;
}

/**
 * 方法 B：用 currentTime 回推，再减去浏览器报告的延迟。
 * currentTime 与 nowPerfMs 必须在同一时刻读取。
 */
export function heardTimeFromCurrentTime(
  currentTime: number,
  nowPerfMs: number,
  eventPerfMs: number,
  reportedLatency: number,
): number {
  return currentTime - (nowPerfMs - eventPerfMs) / 1000 - reportedLatency;
}
