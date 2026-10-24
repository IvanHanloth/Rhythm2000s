// Records: the best score per chart, kept in browser storage (doc/results.md).
// Read / write failures (private mode etc.) count as no record and don't affect play.
// 最好成绩是开着律动组件打的时候，另存一个标记（doc/beat-guide.md「记成绩」）。

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

/** 最好成绩是不是开着律动组件打的；没有成绩或读不到时为 false */
export function loadBestAssisted(chartId: string): boolean {
  try {
    return localStorage.getItem(ASSIST_PREFIX + chartId) === '1';
  } catch {
    return false;
  }
}

/**
 * Records a round's score; saves and returns true when it is above 0 and beats the previous best (or is the first).
 * assisted：这一局开过律动组件，随新纪录一起记下；不用辅助的新纪录会去掉旧标记。
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
