// Loads the dance charts in public/dance/ at start-up (doc/dance-machine.md "Chart format"): the index, then every
// chart it lists. A chart with errors is skipped and its errors returned for the console.

import { parseDanceChart, parseDanceIndex, type DanceChart } from './steps.ts';

export const DANCE_INDEX_FILE = 'index.json';

export type FetchDanceJson = (file: string) => Promise<unknown>;

export interface DanceLoadResult {
  charts: DanceChart[];
  errors: string[];
}

export async function loadDanceCharts(fetchJson: FetchDanceJson): Promise<DanceLoadResult> {
  let indexData: unknown;
  try {
    indexData = await fetchJson(DANCE_INDEX_FILE);
  } catch (error) {
    return { charts: [], errors: [`Dance index ${DANCE_INDEX_FILE}: ${String(error)}`] };
  }
  const index = parseDanceIndex(indexData);
  if (!index.ok) {
    return { charts: [], errors: index.errors.map((e) => `Dance index ${DANCE_INDEX_FILE}: ${e}`) };
  }

  const charts: DanceChart[] = [];
  const errors: string[] = [];
  const files = await Promise.all(
    index.value.charts.map(async (file) => {
      try {
        return { file, data: await fetchJson(file), error: null };
      } catch (error) {
        return { file, data: null, error: String(error) };
      }
    }),
  );
  for (const { file, data, error } of files) {
    if (error !== null) {
      errors.push(`Dance chart ${file}: ${error}`);
      continue;
    }
    const result = parseDanceChart(data, file.replace(/\.json$/, ''));
    if (result.ok) charts.push(result.value);
    else errors.push(...result.errors.map((e) => `Dance chart ${file}: ${e}`));
  }
  return { charts, errors };
}

/** Browser fetch from the site's dance/ folder, bypassing the cache so edited charts show up on refresh */
export function fetchDanceFromSite(baseUrl: string): FetchDanceJson {
  return async (file) => {
    const response = await fetch(`${baseUrl}dance/${file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`download failed (HTTP ${response.status})`);
    return response.json();
  };
}
