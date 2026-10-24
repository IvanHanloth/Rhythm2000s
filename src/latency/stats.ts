// 输入偏差的统计。数值单位由调用方决定（原型里用毫秒）。

export interface Summary {
  count: number;
  mean: number;
  median: number;
  /** 总体标准差 */
  stdDev: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function summarize(values: readonly number[]): Summary {
  const count = values.length;
  if (count === 0) {
    return { count, mean: Number.NaN, median: Number.NaN, stdDev: Number.NaN };
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / count;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;
  return { count, mean, median: median(values), stdDev: Math.sqrt(variance) };
}

/** 排序后去掉最小和最大各 fraction 比例的值。 */
export function trim(values: readonly number[], fraction: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * fraction);
  return sorted.slice(cut, sorted.length - cut);
}

export interface CalibrationOptions {
  /** 跳过最早的几次输入（刚开始找节奏） */
  skipFirst?: number;
  /** 两端各去掉的比例 */
  trimFraction?: number;
  /** 去掉之后至少要剩几个样本才给出建议 */
  minSamples?: number;
}

/**
 * 建议校准值：按时间顺序的偏差，跳过开头几次、去掉两端极值后取中位数。
 * 样本不够时返回 null。
 */
export function suggestCalibration(
  offsetsInOrder: readonly number[],
  { skipFirst = 4, trimFraction = 0.1, minSamples = 4 }: CalibrationOptions = {},
): number | null {
  const kept = trim(offsetsInOrder.slice(skipFirst), trimFraction);
  return kept.length >= minSamples ? median(kept) : null;
}
