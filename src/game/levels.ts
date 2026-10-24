// Levels: one chart is one level, ordered by scene registration and then by the chart index (public/charts/index.json).
// The net café has one computer per scene; inside, levels are picked in Explorer / Finder (doc/level-select.md). #scene/chart opens a level directly.
// No DOM, so unit tests can use it directly.

import { ACTION_LABELS } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import type { SceneId } from '@/scenes/catalog.ts';

export interface Level {
  /** Chart id */
  id: string;
  sceneId: SceneId;
  sceneLabel: string;
  /** Level number within its scene (from 1) */
  number: number;
  title: string;
  bpm: number;
  /** Widgets the chart uses, in order of first appearance, e.g. "Error box, Warning box" */
  actions: string;
}

export function buildLevels(
  scenes: readonly { id: SceneId; label: string }[],
  charts: readonly Chart[],
): Level[] {
  return scenes.flatMap((scene) =>
    charts
      .filter((chart) => chart.scene === scene.id)
      .map((chart, i) => ({
        id: chart.id,
        sceneId: scene.id,
        sceneLabel: scene.label,
        number: i + 1,
        title: chart.title,
        bpm: chart.bpm,
        actions: [...new Set(chart.calls.map((call) => ACTION_LABELS[call.action]))].join(', '),
      })),
  );
}

export type Route = { kind: 'hub' } | { kind: 'scene'; sceneId: SceneId; chartId?: string };

/**
 * Parses the part of the URL after #: empty or unknown goes back to the street;
 * `scene` opens a scene (it picks the chart), `scene/chart` opens one level.
 */
export function parseRoute(hash: string, sceneIds: readonly SceneId[]): Route {
  const [id, chartId] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
  const sceneId = sceneIds.find((known) => known === id);
  if (!sceneId) return { kind: 'hub' };
  return chartId ? { kind: 'scene', sceneId, chartId } : { kind: 'scene', sceneId };
}

/**
 * Best-score line on the intro, e.g. "Best score 04250"; null with no score (scoring rules: doc/results.md).
 * A best score set with the beat guide on gets " (Beat Guide)" (doc/beat-guide.md).
 */
export function formatBestScore(score: number | null, assisted = false): string | null {
  if (score === null) return null;
  return `Best score ${String(score).padStart(5, '0')}${assisted ? ' (Beat Guide)' : ''}`;
}
