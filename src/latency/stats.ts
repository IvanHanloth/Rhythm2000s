// Statistics on input offsets. Units are up to the caller (the prototype uses ms).

export interface Summary {
  count: number;
  mean: number;
  median: number;
  /** Population standard deviation */
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

/** Sorts, then drops the smallest and largest `fraction` of values. */
export function trim(values: readonly number[], fraction: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * fraction);
  return sorted.slice(cut, sorted.length - cut);
}

export interface CalibrationOptions {
  /** Skip the earliest inputs (finding the beat) */
  skipFirst?: number;
  /** Fraction dropped from each end */
  trimFraction?: number;
  /** Minimum samples left after dropping before suggesting anything */
  minSamples?: number;
}

/**
 * Suggested calibration: from offsets in time order, skip the first few, drop the extremes, take the median.
 * Returns null without enough samples.
 */
export function suggestCalibration(
  offsetsInOrder: readonly number[],
  { skipFirst = 4, trimFraction = 0.1, minSamples = 4 }: CalibrationOptions = {},
): number | null {
  const kept = trim(offsetsInOrder.slice(skipFirst), trimFraction);
  return kept.length >= minSamples ? median(kept) : null;
}
