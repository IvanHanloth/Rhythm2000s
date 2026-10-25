// Checks the real chart files in assets/public/charts/: the index lists them all and every chart passes the load-time checks.

import { describe, expect, it } from 'vite-plus/test';
import { parseChartIndex } from '@/rhythm/chart-file.ts';
import { CHART_INDEX_FILE, checkChartData } from './chart-loader.ts';

const files = import.meta.glob<string>('/assets/public/charts/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const byName = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.split('/').pop()!, JSON.parse(text)]),
);

describe('assets/public/charts', () => {
  const index = parseChartIndex(byName[CHART_INDEX_FILE]);

  it('the index is valid and lists every chart file in the folder', () => {
    expect(index.ok).toBe(true);
    const listed = index.ok ? [...index.value.charts].sort() : [];
    const present = Object.keys(byName)
      .filter((name) => name !== CHART_INDEX_FILE)
      .sort();
    expect(listed).toEqual(present);
  });

  it.each(Object.keys(byName).filter((name) => name !== CHART_INDEX_FILE))(
    '%s passes validation',
    (name) => {
      const result = checkChartData(byName[name], name.replace(/\.json$/, ''));
      expect(result.errors).toEqual([]);
    },
  );
});
