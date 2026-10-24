// 每首谱面的最佳成绩，保存在浏览器本地；读写失败（隐私模式等）时当作没有记录。
// 评级规则还没定（doc/game-design.md「进度结构」），这里只记判定个数，按「Perfect 算 2 分、Good 算 1 分」比较好坏。

import type { JudgementLevel } from '../rhythm/judge.ts';

const RECORDS_KEY = 'rhythm2000s.records';

export type JudgementCounts = Record<JudgementLevel, number>;

/** 谱面 id → 最佳成绩 */
export type Records = Record<string, JudgementCounts>;

/** 比较用的分数：Perfect 2 分，Good 1 分 */
export function scoreOf(counts: JudgementCounts): number {
  return counts.perfect * 2 + counts.good;
}

/** 这一局是否比原来的记录好：分数更高；分数相同时 Miss 更少 */
export function isBetter(next: JudgementCounts, best: JudgementCounts | undefined): boolean {
  if (!best) return true;
  const diff = scoreOf(next) - scoreOf(best);
  return diff > 0 || (diff === 0 && next.miss < best.miss);
}

/** 把一局的结果并进记录，返回新的记录表（不修改原表） */
export function mergeResult(records: Records, chartId: string, counts: JudgementCounts): Records {
  return isBetter(counts, records[chartId]) ? { ...records, [chartId]: { ...counts } } : records;
}

function isCounts(value: unknown): value is JudgementCounts {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (['perfect', 'good', 'miss'] as const).every(
    (k) => typeof v[k] === 'number' && Number.isInteger(v[k]) && (v[k] as number) >= 0,
  );
}

/** 解析保存的记录；格式不对的条目丢掉 */
export function parseRecords(text: string | null): Records {
  if (!text) return {};
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isCounts(v))) as Records;
  } catch {
    return {};
  }
}

export function loadRecords(): Records {
  try {
    return parseRecords(localStorage.getItem(RECORDS_KEY));
  } catch {
    return {};
  }
}

/** 记下一局的结果；比原来的好才覆盖。返回更新后的记录表 */
export function saveResult(chartId: string, counts: JudgementCounts): Records {
  const records = mergeResult(loadRecords(), chartId, counts);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // 保存失败只影响下次打开，不影响本次游戏
  }
  return records;
}
