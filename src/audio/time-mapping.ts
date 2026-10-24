// Converts input event times (performance.now() timeline, ms) into
// "the audio the speakers were playing at that moment" (AudioContext timeline, s).
// Both methods are described in doc/latency-test.md.

export interface OutputStamp {
  /** Audio time being output by the speakers (s) */
  contextTime: number;
  /** When that audio was output (performance.now() timeline, ms) */
  performanceTime: number;
}

/** Whether a getOutputTimestamp() result is usable. Browsers return 0 before audio starts flowing. */
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

/** Method A: linear mapping through a getOutputTimestamp() pair. */
export function heardTimeFromStamp(stamp: OutputStamp, eventPerfMs: number): number {
  return stamp.contextTime + (eventPerfMs - stamp.performanceTime) / 1000;
}

/**
 * Method B: work back from currentTime, then subtract the reported latency.
 * currentTime and nowPerfMs must be read at the same moment.
 */
export function heardTimeFromCurrentTime(
  currentTime: number,
  nowPerfMs: number,
  eventPerfMs: number,
  reportedLatency: number,
): number {
  return currentTime - (nowPerfMs - eventPerfMs) / 1000 - reportedLatency;
}
