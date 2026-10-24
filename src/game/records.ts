// Records: the best score per chart, kept in browser storage (doc/results.md).
// Read / write failures (private mode etc.) count as no record and don't affect play.
// A best score set with the beat guide on is flagged separately (doc/beat-guide.md).

const KEY_PREFIX = 'rhythm2000s.best.';
const ASSIST_PREFIX = 'rhythm2000s.bestAssist.';

export function loadBestScore(chartId: string): number | null {
  try {
    const value = localStorage.getItem(KEY_PREFIX + chartId);
    const score = value === null ? NaN : Number(value);
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}

/** Whether the best score was set with the beat guide on; false without a score or when unreadable */
export function loadBestAssisted(chartId: string): boolean {
  try {
    return localStorage.getItem(ASSIST_PREFIX + chartId) === '1';
  } catch {
    return false;
  }
}

/**
 * Records a round's score; saves and returns true when it is above 0 and beats the previous best (or is the first).
 * `assisted` (the beat guide was on) is saved with a new best; an unassisted new best clears the flag.
 */
export function recordScore(chartId: string, score: number, assisted = false): boolean {
  if (score <= 0) return false;
  const best = loadBestScore(chartId);
  if (best !== null && score <= best) return false;
  try {
    localStorage.setItem(KEY_PREFIX + chartId, String(score));
    if (assisted) localStorage.setItem(ASSIST_PREFIX + chartId, '1');
    else localStorage.removeItem(ASSIST_PREFIX + chartId);
  } catch {
    // A failed save only affects later "new record" checks
  }
  return true;
}
