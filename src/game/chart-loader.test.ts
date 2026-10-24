import { describe, expect, it } from 'vite-plus/test';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { loadCharts, type FetchChartJson } from './chart-loader.ts';

/** Fake fetch: files missing from `files` are a 404 */
function fakeFetch(files: Record<string, unknown>): FetchChartJson {
  return async (file) => {
    if (!(file in files)) throw new Error('download failed (HTTP 404)');
    const value = files[file];
    if (value instanceof Error) throw value;
    return value;
  };
}

const good = sourceFromPatterns([[0, 1, 2]], { id: 'good' });

describe('loadCharts', () => {
  it('loads valid charts in index order', async () => {
    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['good.json'] },
        'good.json': good,
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.charts.map((c) => c.chart.id)).toEqual(['good']);
  });

  it('no charts and an error when the index fails to download', async () => {
    const result = await loadCharts(fakeFetch({}));
    expect(result).toEqual({
      charts: [],
      errors: ['Chart index index.json: download failed (HTTP 404)'],
    });
  });

  it('skips broken charts, loads the rest, and names the file in errors', async () => {
    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['missing.json', 'broken.json', 'good.json'] },
        'broken.json': new SyntaxError('Unexpected token'),
        'good.json': good,
      }),
    );
    expect(result.charts.map((c) => c.chart.id)).toEqual(['good']);
    expect(result.errors).toEqual([
      'Chart missing.json: download failed (HTTP 404)',
      'Chart broken.json: not valid JSON (Unexpected token)',
    ]);
  });

  it('also checks scene rules and turn-cue timing', async () => {
    const mismatched = sourceFromPatterns([[0, 1]], { id: 'mismatched' });
    mismatched.phrases[0]!.response = [{ beat: 0, action: 'dialog-info' }];
    const late = sourceFromPatterns([[0, 3.5], [0]], { id: 'late' });

    const result = await loadCharts(
      fakeFetch({
        'index.json': { format: 1, charts: ['mismatched.json', 'late.json'] },
        'mismatched.json': mismatched,
        'late.json': late,
      }),
    );
    expect(result.charts).toEqual([]);
    expect(result.errors[0]).toContain(
      'Chart mismatched.json: phrases[0]: the XP scene needs as many response events as call events',
    );
    expect(result.errors[1]).toContain('Chart late.json: phrases[0].call[1]: beat 3.5 is too late');
  });

  it('the XP scene needs the response dialogs in the same order as the call', async () => {
    const swapped = sourceFromPatterns([[0, 1]], { id: 'swapped' });
    swapped.phrases[0]!.call[1]!.action = 'dialog-error';
    swapped.phrases[0]!.response = [
      { beat: 0, action: 'dialog-info' },
      { beat: 1, action: 'dialog-warning' },
    ];

    const result = await loadCharts(
      fakeFetch({ 'index.json': { format: 1, charts: ['swapped.json'] }, 'swapped.json': swapped }),
    );
    expect(result.errors).toEqual([
      'Chart swapped.json: phrases[0].response[1]: the XP scene needs the same action as call event 2 (dialog-error)',
    ]);
  });
});
