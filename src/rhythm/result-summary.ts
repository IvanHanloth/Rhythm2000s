// Results: turns a round's judgements into score, rating, offset histogram and comments (doc/results.md; all rules provisional). No PixiJS.

import type { JudgementLevel } from './judge.ts';

/** One press's judgement: grade, offset (s, positive is late, null for Miss), phrase index (from 0) */
export interface HitResult {
  level: JudgementLevel;
  offset: number | null;
  phrase: number;
}

export type Rank = 'superb' | 'ok' | 'tryAgain';

export const RANK_LABELS: Record<Rank, string> = {
  superb: 'Superb',
  ok: 'OK',
  tryAgain: 'Try again',
};

export const MAX_SCORE = 10000;
/** Lowest score for each rating */
const RANK_THRESHOLDS: [Rank, number][] = [
  ['superb', 8000],
  ['ok', 6000],
];

/** Offset histogram: 11 bins of 20 ms, the middle bin is on the beat */
export const OFFSET_BINS = 11;
export const OFFSET_BIN_MS = 20;
/** Only mention early / late when the mean offset is beyond this */
const DRIFT_HINT_MS = 20;
const DRIFT_MIN_HITS = 4;
/** At most this many phrases with mistakes are listed */
const MAX_LISTED_PHRASES = 3;

export interface ResultSummary {
  counts: Record<JudgementLevel, number>;
  score: number;
  rank: Rank;
  /** Mean offset of hits (ms, positive is late); null with no hits */
  meanOffsetMs: number | null;
  /** Hits per bin, from "100 ms early" to "100 ms late" */
  bins: number[];
  /** Phrases with a Miss, counted from 1, ascending */
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
      superb: 'Rock-steady rhythm. Well played.',
      ok: 'You mostly kept up with the beat.',
      tryAgain: "You haven't found the beat yet. Listen to the call again.",
    }[rank],
  ];

  if (missedPhrases.length === 0) {
    comments.push('No mistakes.');
  } else {
    const listed = missedPhrases.slice(0, MAX_LISTED_PHRASES).join(', ');
    const more = missedPhrases.length > MAX_LISTED_PHRASES ? ' and more' : '';
    comments.push(`Phrases ${listed}${more} had mistakes.`);
  }

  if (meanOffsetMs !== null && hitCount >= DRIFT_MIN_HITS) {
    const ms = Math.round(Math.abs(meanOffsetMs));
    if (ms >= DRIFT_HINT_MS) {
      const side = meanOffsetMs > 0 ? 'late' : 'early';
      comments.push(`You were ${ms} ms ${side} on average. Try recalibrating.`);
    } else {
      comments.push('Your timing was neither early nor late.');
    }
  }
  return comments;
}

/** Score as five digits, e.g. 08250 */
export function formatScore(score: number): string {
  return String(Math.max(0, Math.round(score))).padStart(5, '0');
}
