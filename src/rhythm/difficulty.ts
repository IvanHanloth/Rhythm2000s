// Difficulty (doc/difficulty.md, ADR 0019): each save plays every chart at its difficulty's speed, and the score it
// keeps is the round's score times that speed. No PixiJS.

import type { Chart } from './chart.ts';

export type Difficulty = 'heaven' | 'easy' | 'normal' | 'hard' | 'hell';

/** Slowest to fastest, as the radio buttons list them */
export const DIFFICULTIES: readonly Difficulty[] = ['heaven', 'easy', 'normal', 'hard', 'hell'];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** How many times the chart's own tempo each difficulty plays at */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  heaven: 0.5,
  easy: 0.8,
  normal: 1,
  hard: 1.2,
  hell: 1.5,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  heaven: 'Heaven',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  hell: 'Hell',
};

/** The fastest speed, which every chart must work at (doc/chart-format.md "Timing limits") */
export const FASTEST_SPEED = Math.max(...DIFFICULTIES.map((d) => DIFFICULTY_SPEEDS[d]));

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((difficulty) => difficulty === value);
}

/** "×1.2" */
export function formatSpeed(difficulty: Difficulty): string {
  return `×${DIFFICULTY_SPEEDS[difficulty].toFixed(1)}`;
}

/** "Hard (×1.2)" */
export function describeDifficulty(difficulty: Difficulty): string {
  return `${DIFFICULTY_LABELS[difficulty]} (${formatSpeed(difficulty)})`;
}

/** The chart at a speed: only the tempo changes, since every other time in a chart is in beats */
export function chartAtSpeed(chart: Chart, speed: number): Chart {
  if (!(speed > 0)) throw new RangeError(`Speed must be greater than 0, got ${speed}`);
  return speed === 1 ? chart : { ...chart, bpm: chart.bpm * speed };
}

export function chartAtDifficulty(chart: Chart, difficulty: Difficulty): Chart {
  return chartAtSpeed(chart, DIFFICULTY_SPEEDS[difficulty]);
}

/** The score a round keeps: its score (0–10000) times the difficulty's speed, rounded */
export function recordedScore(score: number, difficulty: Difficulty): number {
  return Math.round(score * DIFFICULTY_SPEEDS[difficulty]);
}
