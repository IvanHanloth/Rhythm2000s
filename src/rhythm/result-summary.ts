// 结算：把一局的判定整理成得分、评级、偏差分布和评语（doc/results.md，规则都是暂定）。不依赖 PixiJS。

import type { JudgementLevel } from './judge.ts';

/** 一下的判定：等级、偏差（秒，正数表示晚，Miss 为 null）、属于第几个乐句（从 0 开始） */
export interface HitResult {
  level: JudgementLevel;
  offset: number | null;
  phrase: number;
}

export type Rank = 'superb' | 'ok' | 'tryAgain';

export const RANK_LABELS: Record<Rank, string> = {
  superb: '优秀',
  ok: '及格',
  tryAgain: '再试一次',
};

/** 满分 */
export const MAX_SCORE = 10000;
/** 评级的得分下限 */
const RANK_THRESHOLDS: [Rank, number][] = [
  ['superb', 8000],
  ['ok', 6000],
];

/** 偏差分布：11 格，每格 20 毫秒，中间一格是拍点 */
export const OFFSET_BINS = 11;
export const OFFSET_BIN_MS = 20;
/** 平均偏差超过它才提示偏早 / 偏晚 */
const DRIFT_HINT_MS = 20;
const DRIFT_MIN_HITS = 4;
/** 评语里最多列几个出错的乐句 */
const MAX_LISTED_PHRASES = 3;

export interface ResultSummary {
  counts: Record<JudgementLevel, number>;
  score: number;
  rank: Rank;
  /** 命中的平均偏差（毫秒，正数表示晚）；没有命中时为 null */
  meanOffsetMs: number | null;
  /** 每格命中次数，从「早 100 毫秒」到「晚 100 毫秒」 */
  bins: number[];
  /** 有 Miss 的乐句，从 1 开始数，从小到大 */
  missedPhrases: number[];
  comments: string[];
}

export function summarizeResult(hits: readonly HitResult[]): ResultSummary {
  const counts: Record<JudgementLevel, number> = { perfect: 0, good: 0, miss: 0 };
  for (const hit of hits) counts[hit.level]++;

  const points = counts.perfect + counts.good * 0.5;
  const score = hits.length > 0 ? Math.round((points / hits.length) * MAX_SCORE) : 0;
  const rank = RANK_THRESHOLDS.find(([, min]) => score >= min)?.[0] ?? 'tryAgain';

  const offsetsMs = hits.flatMap((h) => (h.offset === null ? [] : [h.offset * 1000]));
  const meanOffsetMs =
    offsetsMs.length > 0 ? offsetsMs.reduce((a, b) => a + b, 0) / offsetsMs.length : null;

  const bins = Array.from({ length: OFFSET_BINS }, () => 0);
  const half = (OFFSET_BINS - 1) / 2;
  for (const ms of offsetsMs) {
    const index = Math.round(ms / OFFSET_BIN_MS) + half;
    bins[Math.min(OFFSET_BINS - 1, Math.max(0, index))]!++;
  }

  const missedPhrases = [
    ...new Set(hits.filter((h) => h.level === 'miss').map((h) => h.phrase + 1)),
  ].sort((a, b) => a - b);

  return {
    counts,
    score,
    rank,
    meanOffsetMs,
    bins,
    missedPhrases,
    comments: buildComments(rank, missedPhrases, meanOffsetMs, offsetsMs.length),
  };
}

function buildComments(
  rank: Rank,
  missedPhrases: number[],
  meanOffsetMs: number | null,
  hitCount: number,
): string[] {
  const comments = [
    {
      superb: '节奏很稳，干得漂亮。',
      ok: '大体跟上了节奏。',
      tryAgain: '还没找到节奏，再仔细听一遍示范。',
    }[rank],
  ];

  if (missedPhrases.length === 0) {
    comments.push('没有失误。');
  } else {
    const listed = missedPhrases.slice(0, MAX_LISTED_PHRASES).join('、');
    const more = missedPhrases.length > MAX_LISTED_PHRASES ? ' 等' : ' ';
    comments.push(`第 ${listed}${more}乐句有失误。`);
  }

  if (meanOffsetMs !== null && hitCount >= DRIFT_MIN_HITS) {
    const ms = Math.round(Math.abs(meanOffsetMs));
    if (ms >= DRIFT_HINT_MS) {
      const side = meanOffsetMs > 0 ? '偏晚' : '偏早';
      comments.push(`整体${side} ${ms} 毫秒，可以试试重新校准。`);
    } else {
      comments.push('按键时机没有明显偏早或偏晚。');
    }
  }
  return comments;
}

/** 得分写成五位数，如 08250 */
export function formatScore(score: number): string {
  return String(Math.max(0, Math.round(score))).padStart(5, '0');
}
