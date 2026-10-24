// Latency test input records and grouped statistics.

import { suggestCalibration, summarize, type Summary } from '@/latency/stats.ts';

export type InputKind = 'keyboard' | 'mouse' | 'touch' | 'pen';
export type Method = 'A' | 'B';

export const INPUT_KINDS: readonly InputKind[] = ['keyboard', 'mouse', 'touch', 'pen'];

export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  touch: 'Touch',
  pen: 'Pen',
};

export const METHOD_LABELS: Record<Method, string> = {
  A: 'A: getOutputTimestamp',
  B: 'B: currentTime − latency',
};

export interface TapRecord {
  /** Input number, from 0 */
  seq: number;
  kind: InputKind;
  /** event.timeStamp (ms) */
  eventTimeStamp: number;
  /** event.timeStamp was unusable, so the callback's performance.now() was used */
  timeStampFallback: boolean;
  /** Nearest beat number */
  beat: number;
  /** Offset by method A (ms); null when the method is unavailable */
  offsetA: number | null;
  /** Offset by method B (ms) */
  offsetB: number;
  /** Latency the browser reported at the input (ms) */
  baseLatencyMs: number;
  outputLatencyMs: number;
}

export interface StatsRow {
  kind: InputKind;
  method: Method;
  summary: Summary;
  /** Suggested calibration (ms); null without enough samples */
  calibration: number | null;
}

/** Statistics grouped by input type × conversion method. taps must be in time order. */
export function buildStatsRows(taps: readonly TapRecord[]): StatsRow[] {
  const rows: StatsRow[] = [];
  for (const kind of INPUT_KINDS) {
    const ofKind = taps.filter((tap) => tap.kind === kind);
    if (ofKind.length === 0) continue;

    const offsetsA = ofKind.flatMap((tap) => (tap.offsetA == null ? [] : [tap.offsetA]));
    const offsetsB = ofKind.map((tap) => tap.offsetB);
    if (offsetsA.length > 0) {
      rows.push({
        kind,
        method: 'A',
        summary: summarize(offsetsA),
        calibration: suggestCalibration(offsetsA),
      });
    }
    rows.push({
      kind,
      method: 'B',
      summary: summarize(offsetsB),
      calibration: suggestCalibration(offsetsB),
    });
  }
  return rows;
}
