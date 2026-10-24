// Records: the best score per chart, kept in browser storage (doc/results.md).
// Read / write failures (private mode etc.) count as no record and don't affect play.

const KEY_PREFIX = 'rhythm2000s.best.';

export function loadBestScore(chartId: string): number | null {
  try {
    const value = localStorage.getItem(KEY_PREFIX + chartId);
    const score = value === null ? NaN : Number(value);
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}

/** Records a round's score; saves and returns true when it is above 0 and beats the previous best (or is the first) */
export function recordScore(chartId: string, score: number): boolean {
  if (score <= 0) return false;
  const best = loadBestScore(chartId);
  if (best !== null && score <= best) return false;
  try {
    localStorage.setItem(KEY_PREFIX + chartId, String(score));
  } catch {
    // A failed save only affects later "new record" checks
  }
  return true;
}
