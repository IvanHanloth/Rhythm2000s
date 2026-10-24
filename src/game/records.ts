// 成绩记录：每首谱面的最好得分，保存在浏览器本地（doc/results.md）。
// 读写失败（隐私模式等）时当作没有记录，不影响游戏。

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

/** 记录这一局的得分；得分大于 0、且比以前的最好成绩高（或第一次玩）时保存并返回 true */
export function recordScore(chartId: string, score: number): boolean {
  if (score <= 0) return false;
  const best = loadBestScore(chartId);
  if (best !== null && score <= best) return false;
  try {
    localStorage.setItem(KEY_PREFIX + chartId, String(score));
  } catch {
    // 保存失败只影响以后的「新纪录」判断
  }
  return true;
}
