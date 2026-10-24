// Chart loading: downloads the index and chart files in public/charts/ at runtime and validates each (ADR 0003).
// Broken charts are skipped without affecting the others; errors are collected for the caller to show.

import { buildChart, type Chart } from '../rhythm/chart.ts';
import { parseChartFile, parseChartIndex } from '../rhythm/chart-file.ts';
import { MVP_WINDOWS } from '../rhythm/judge.ts';
import { checkTurnCueSpacing } from '../rhythm/turn-cue.ts';
import { sceneActions, SCENE_CATALOG, type SceneId } from '../scenes/catalog.ts';

export const CHART_INDEX_FILE = 'index.json';

/** Downloads a file from charts/ and parses it as JSON; throws on failure */
export type FetchChartJson = (file: string) => Promise<unknown>;

export interface ChartLoadResult {
  charts: Chart[];
  /** One per line, file name included */
  errors: string[];
}

export async function loadCharts(fetchJson: FetchChartJson): Promise<ChartLoadResult> {
  const errors: string[] = [];

  let indexData: unknown;
  try {
    indexData = await fetchJson(CHART_INDEX_FILE);
  } catch (error) {
    return { charts: [], errors: [`Chart index ${CHART_INDEX_FILE}: ${describe(error)}`] };
  }
  const index = parseChartIndex(indexData);
  if (!index.ok) {
    return { charts: [], errors: index.errors.map((e) => `Chart index ${CHART_INDEX_FILE}: ${e}`) };
  }

  // Download in parallel, collect results in index order
  const results = await Promise.all(
    index.value.charts.map(async (file) => {
      try {
        return { file, data: await fetchJson(file) };
      } catch (error) {
        return { file, error: describe(error) };
      }
    }),
  );

  const charts: Chart[] = [];
  for (const result of results) {
    const prefix = `Chart ${result.file}: `;
    if ('error' in result) {
      errors.push(prefix + result.error);
      continue;
    }
    const problems = checkChartData(result.data, result.file.replace(/\.json$/, ''));
    if (problems.chart) {
      charts.push(problems.chart);
    } else {
      errors.push(...problems.errors.map((e) => prefix + e));
    }
  }
  return { charts, errors };
}

/** Validates one chart: format, scene rules, turn-cue timing. */
export function checkChartData(
  data: unknown,
  expectedId?: string,
): { chart: Chart; errors: [] } | { chart: null; errors: string[] } {
  const parsed = parseChartFile(data, { scenes: sceneActions(), expectedId });
  if (!parsed.ok) return { chart: null, errors: parsed.errors };

  const chart = buildChart(parsed.value);
  const scene = SCENE_CATALOG[chart.scene as SceneId];
  const errors = [
    ...(scene.checkChart?.(chart) ?? []),
    ...checkTurnCueSpacing(chart, MVP_WINDOWS.good),
  ];
  return errors.length > 0 ? { chart: null, errors } : { chart, errors: [] };
}

function describe(error: unknown): string {
  if (error instanceof SyntaxError) return `not valid JSON (${error.message})`;
  return error instanceof Error ? error.message : String(error);
}

/** Browser fetch: reads from the site's charts/ folder, bypassing the cache so edited charts show up on refresh */
export function fetchChartFromSite(baseUrl: string): FetchChartJson {
  return async (file) => {
    const response = await fetch(`${baseUrl}charts/${file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`download failed (HTTP ${response.status})`);
    return response.json();
  };
}
