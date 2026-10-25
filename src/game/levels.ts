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

export type Route =
  | { kind: 'hub' }
  | { kind: 'scene'; sceneId: SceneId; chartId?: string }
  | { kind: 'editor'; sceneId: SceneId }
  | { kind: 'showcase'; sceneId: SceneId }
  | { kind: 'dance' };

/** URL route of the arcade's dance machine (doc/dance-machine.md) */
export const DANCE_ROUTE = 'dance-machine';
/** First part of an editor route, `editor/<scene>` (doc/chart-editor.md) */
export const EDITOR_ROUTE = 'editor';
/** First part of a showcase route, `showcase/<scene>` (doc/showcase.md) */
export const SHOWCASE_ROUTE = 'showcase';

/** The URL route (without #) of a scene's chart editor computer */
export function editorRoute(sceneId: SceneId): string {
  return `${EDITOR_ROUTE}/${sceneId}`;
}

/** The URL route (without #) of a scene's showcase computer */
export function showcaseRoute(sceneId: SceneId): string {
  return `${SHOWCASE_ROUTE}/${sceneId}`;
}

/** The café computer a route is sat at: the scene's play computer, its editor or its showcase computer; null on the street */
export function computerOf(route: Route): string | null {
  switch (route.kind) {
    case 'hub':
    case 'dance':
      return null;
    case 'scene':
      return route.sceneId;
    case 'editor':
      return editorRoute(route.sceneId);
    case 'showcase':
      return showcaseRoute(route.sceneId);
  }
}

/**
 * Parses the part of the URL after #: empty or unknown goes back to the street;
 * `scene` opens a scene (it picks the chart), `scene/chart` opens one level, `editor/scene` opens the scene's
 * chart editor, `showcase/scene` its showcase tour, `dance-machine` the arcade's dance machine.
 */
export function parseRoute(hash: string, sceneIds: readonly SceneId[]): Route {
  const [id, chartId] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
  if (id === DANCE_ROUTE && chartId === undefined) return { kind: 'dance' };
  if (id === EDITOR_ROUTE || id === SHOWCASE_ROUTE) {
    const sceneId = sceneIds.find((known) => known === chartId);
    if (!sceneId) return { kind: 'hub' };
    return id === EDITOR_ROUTE ? { kind: 'editor', sceneId } : { kind: 'showcase', sceneId };
  }
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
