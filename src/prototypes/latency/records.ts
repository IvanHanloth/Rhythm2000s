// 延迟测试的输入记录与分组统计。

import { suggestCalibration, summarize, type Summary } from '../../latency/stats.ts';

export type InputKind = 'keyboard' | 'mouse' | 'touch' | 'pen';
export type Method = 'A' | 'B';

export const INPUT_KINDS: readonly InputKind[] = ['keyboard', 'mouse', 'touch', 'pen'];

export const INPUT_KIND_LABELS: Record<InputKind, string> = {
  keyboard: '键盘',
  mouse: '鼠标',
  touch: '触摸',
  pen: '触控笔',
};

export const METHOD_LABELS: Record<Method, string> = {
  A: 'A：getOutputTimestamp',
  B: 'B：currentTime − 延迟',
};

export interface TapRecord {
  /** 第几次输入，从 0 开始 */
  seq: number;
  kind: InputKind;
  /** event.timeStamp（毫秒） */
  eventTimeStamp: number;
  /** event.timeStamp 不可信时改用了回调时的 performance.now() */
  timeStampFallback: boolean;
  /** 最近的拍序号 */
  beat: number;
  /** 方法 A 的偏差（毫秒）；该方法不可用时为 null */
  offsetA: number | null;
  /** 方法 B 的偏差（毫秒） */
  offsetB: number;
  /** 输入时浏览器报告的延迟（毫秒） */
  baseLatencyMs: number;
  outputLatencyMs: number;
}

export interface StatsRow {
  kind: InputKind;
  method: Method;
  summary: Summary;
  /** 建议校准值（毫秒）；样本不够时为 null */
  calibration: number | null;
}

/** 按「输入类型 × 换算方法」分组统计。taps 必须按时间顺序排列。 */
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
