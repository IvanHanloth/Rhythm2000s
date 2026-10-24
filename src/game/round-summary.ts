// 一局的结算：评级、得分、按键偏差分布、评语（结算页 results-screen.ts 显示）。
// 评级分档、得分算法都是暂定（doc/game-design.md「进度结构」），参照设计画布的结算页和《节奏天国》的三档评价。
// 不依赖 DOM，单元测试可以直接用。

import type { Chart } from '../rhythm/chart.ts';
import type { Judgement, JudgementLevel } from '../rhythm/judge.ts';
import type { JudgementCounts } from './records.ts';

/** 一个跟打目标的判定 */
export interface RoundJudgement {
  level: JudgementLevel;
  /** 偏差（秒），正数表示晚；Miss 时为 null */
  offset: number | null;
  /** 属于第几个乐句（从 0 开始） */
  phrase: number;
}

/** 场景交给游戏外壳的一局结果 */
export interface RoundResult {
  chartId: string;
  title: string;
  sceneId: string;
  judgements: readonly RoundJudgement[];
}

/** 场景一局里的判定记录 → 交给游戏外壳的结果。target 是跟打目标的下标，据此查出所在乐句 */
export function roundResult(
  chart: Chart,
  judgements: readonly Judgement[],
  sceneId: string,
): RoundResult {
  return {
    chartId: chart.id,
    title: chart.title,
    sceneId,
    judgements: judgements.map((j) => ({
      level: j.level,
      offset: j.offset,
      phrase: chart.responses[j.target]?.phrase ?? 0,
    })),
  };
}

export type Rating = 'superb' | 'ok' | 'try-again';

export const RATING_LABELS: Record<Rating, string> = {
  superb: '优秀',
  ok: '还行',
  'try-again': '再试一次',
};

/** 评级门槛（暂定）：命中率 = (Perfect + 0.5 × Good) / 目标数 */
export const RATING_THRESHOLDS = { superb: 0.85, ok: 0.6 };

/** 每个 Perfect、Good 的得分（暂定） */
const POINTS = { perfect: 100, good: 50, miss: 0 };

/** 偏差分布：从早 100 毫秒到晚 100 毫秒，每 20 毫秒一格，共 11 格；超出的算进两头 */
export const HISTOGRAM_BINS = 11;
const BIN_MS = 20;

/** 偏差在这个范围内就不提醒校准（毫秒） */
const CALIBRATION_HINT_MS = 20;

export interface RoundSummary {
  counts: JudgementCounts;
  total: number;
  score: number;
  accuracy: number;
  rating: Rating;
  /** 命中（Perfect + Good）的平均偏差，毫秒，正数表示晚；没有命中时为 null */
  averageOffsetMs: number | null;
  histogram: number[];
  comments: string[];
}

export function ratingFor(accuracy: number): Rating {
  if (accuracy >= RATING_THRESHOLDS.superb) return 'superb';
  if (accuracy >= RATING_THRESHOLDS.ok) return 'ok';
  return 'try-again';
}

export function summarize(result: RoundResult): RoundSummary {
  const counts: JudgementCounts = { perfect: 0, good: 0, miss: 0 };
  let score = 0;
  const offsets: number[] = [];
  for (const j of result.judgements) {
    counts[j.level]++;
    score += POINTS[j.level];
    if (j.offset !== null) offsets.push(j.offset * 1000);
  }
  const total = result.judgements.length;
  const accuracy = total === 0 ? 0 : (counts.perfect + counts.good * 0.5) / total;

  const histogram = Array.from({ length: HISTOGRAM_BINS }, () => 0);
  const half = (HISTOGRAM_BINS * BIN_MS) / 2;
  for (const ms of offsets) {
    const bin = Math.floor((ms + half) / BIN_MS);
    histogram[Math.min(HISTOGRAM_BINS - 1, Math.max(0, bin))]!++;
  }
  const averageOffsetMs =
    offsets.length === 0 ? null : offsets.reduce((a, b) => a + b, 0) / offsets.length;

  return {
    counts,
    total,
    score,
    accuracy,
    rating: ratingFor(accuracy),
    averageOffsetMs,
    histogram,
    comments: commentsFor(result, counts, averageOffsetMs),
  };
}

/** 评语：几句平静、略显多余地客气的话，模仿系统对话框的腔调（设计系统「文案」一节） */
function commentsFor(
  result: RoundResult,
  counts: JudgementCounts,
  averageOffsetMs: number | null,
): string[] {
  const comments: string[] = [];
  const total = result.judgements.length;
  if (total === 0) return ['这一局没有需要处理的目标。'];

  if (counts.perfect === total) comments.push('全部 Perfect。节拍已完全同步。');
  else if (counts.miss === 0) comments.push('一个都没有漏掉。');
  else if (counts.miss === total)
    comments.push('所有目标都已超时。请在「Your turn」之后跟着节拍按下。');

  const missedPhrases = [
    ...new Set(result.judgements.filter((j) => j.level === 'miss').map((j) => j.phrase + 1)),
  ].sort((a, b) => a - b);
  if (missedPhrases.length > 0 && counts.miss < total) {
    const shown = missedPhrases.slice(0, 4).join('、');
    const more = missedPhrases.length > 4 ? '等' : '';
    comments.push(`第 ${shown} ${more}乐句有目标没有处理。`);
  }

  if (averageOffsetMs !== null && counts.perfect + counts.good >= 3) {
    const ms = Math.round(Math.abs(averageOffsetMs));
    if (ms >= CALIBRATION_HINT_MS) {
      const side = averageOffsetMs > 0 ? '偏晚' : '偏早';
      comments.push(`整体${side}约 ${ms} 毫秒。如果一直如此，可以试试重新校准。`);
    } else {
      comments.push(`按键时机很准，平均偏差不到 ${CALIBRATION_HINT_MS} 毫秒。`);
    }
  }
  return comments;
}

/** 五位数得分，例如 08250 */
export function formatScore(score: number): string {
  return String(Math.max(0, Math.round(score))).padStart(5, '0');
}
