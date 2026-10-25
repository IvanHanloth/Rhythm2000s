// Checks the real dance charts in assets/public/dance/: the index lists them all, every chart passes validation and lasts
// at least a minute (doc/dance-machine.md "First songs").

import { describe, expect, it } from 'vite-plus/test';
import { DANCE_INDEX_FILE } from './loader.ts';
import { firstStepBeat, parseDanceChart, parseDanceIndex, songBeats } from './steps.ts';

const files = import.meta.glob<string>('/assets/public/dance/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const byName = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.split('/').pop()!, JSON.parse(text)]),
);
const chartFiles = Object.keys(byName).filter((name) => name !== DANCE_INDEX_FILE);

describe('assets/public/dance', () => {
  it('the index is valid and lists every chart file in the folder', () => {
    const index = parseDanceIndex(byName[DANCE_INDEX_FILE]);
    expect(index.ok).toBe(true);
    const listed = index.ok ? [...index.value.charts].sort() : [];
    expect(listed).toEqual([...chartFiles].sort());
  });

  it.each(chartFiles)('%s is valid and at least a minute long', (name) => {
    const result = parseDanceChart(byName[name], name.replace(/\.json$/, ''));
    if (!result.ok) throw new Error(result.errors.join('; '));
    const chart = result.value;
    const stepBeats = songBeats(chart) - firstStepBeat(chart) - chart.outroBars * chart.beatsPerBar;
    expect((stepBeats * 60) / chart.bpm).toBeGreaterThanOrEqual(60);
  });
});
