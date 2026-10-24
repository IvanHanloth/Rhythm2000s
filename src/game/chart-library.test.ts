import { describe, expect, it, vi } from 'vite-plus/test';
import { buildChart } from '@/rhythm/chart.ts';
import type { ChartSource } from '@/rhythm/chart-file.ts';
import { sourceFromPatterns } from '@/rhythm/test-charts.ts';
import { ChartLibrary, listErrors, type ChartStore } from './chart-library.ts';
import type { LoadedChart } from './chart-loader.ts';

function loaded(source: ChartSource): LoadedChart {
  return { chart: buildChart(source), source };
}

/** In-memory store; `failWrites` makes every save throw like a full or blocked browser storage */
function memoryStore(
  text: string | null = null,
  failWrites = false,
): ChartStore & { text: string | null } {
  return {
    text,
    read() {
      return this.text;
    },
    write(value) {
      if (failWrites) throw new Error('QuotaExceededError');
      this.text = value;
    },
  };
}

const builtIn = sourceFromPatterns([[0, 1, 2]], { id: 'built-in', title: 'Built In' });
const mine = sourceFromPatterns([[0, 2]], { id: 'mine', title: 'Mine' });
const macChart = sourceFromPatterns(
  [[0, 1]],
  { id: 'mac-mine', title: 'Mac Mine', scene: 'mac-2000' },
  'alert-note',
);

describe('ChartLibrary', () => {
  it('lists built-in charts first, then stored imports', () => {
    const library = new ChartLibrary([loaded(builtIn)], memoryStore(JSON.stringify([mine])));
    expect(library.loadErrors).toEqual([]);
    expect(library.charts.map((c) => c.id)).toEqual(['built-in', 'mine']);
    expect(library.isImported('mine')).toBe(true);
    expect(library.isImported('built-in')).toBe(false);
  });

  it('imports a valid chart, saves it and tells listeners', () => {
    const store = memoryStore();
    const library = new ChartLibrary([loaded(builtIn)], store);
    const listener = vi.fn();
    library.onChange(listener);

    const result = library.import(JSON.stringify(mine));
    expect(result).toMatchObject({ ok: true, replaced: false, chart: { id: 'mine' } });
    expect(library.charts.map((c) => c.id)).toEqual(['built-in', 'mine']);
    expect(JSON.parse(store.text!)).toEqual([mine]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('imports a chart for another scene', () => {
    const library = new ChartLibrary([loaded(builtIn)], memoryStore());
    const result = library.import(JSON.stringify(macChart));
    expect(result).toMatchObject({ ok: true, chart: { scene: 'mac-2000' } });
  });

  it('refuses text that is not JSON', () => {
    const library = new ChartLibrary([], memoryStore());
    const result = library.import('{ nope');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toMatch(/^not valid JSON/);
  });

  it('refuses a chart that fails validation, with the same errors as built-in charts', () => {
    const library = new ChartLibrary([], memoryStore());
    const result = library.import(JSON.stringify({ ...mine, bpm: 0 }));
    expect(result).toEqual({ ok: false, errors: ['bpm must be a number greater than 0'] });
    expect(library.charts).toEqual([]);
  });

  it('refuses the id of a built-in chart', () => {
    const library = new ChartLibrary([loaded(builtIn)], memoryStore());
    const result = library.import(JSON.stringify({ ...mine, id: 'built-in' }));
    expect(result).toEqual({
      ok: false,
      errors: ['a built-in level already uses the id "built-in"; give the chart another id'],
    });
  });

  it('replaces an earlier import with the same id in place', () => {
    const other = sourceFromPatterns([[0]], { id: 'other' });
    const store = memoryStore(JSON.stringify([mine, other]));
    const library = new ChartLibrary([], store);

    const result = library.import(JSON.stringify({ ...mine, title: 'Mine v2' }));
    expect(result).toMatchObject({ ok: true, replaced: true });
    expect(library.charts.map((c) => c.title)).toEqual(['Mine v2', 'Test']);
    expect(JSON.parse(store.text!).map((s: ChartSource) => s.title)).toEqual(['Mine v2', 'Test']);
  });

  it('fails without changing anything when the browser refuses to save', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const library = new ChartLibrary([], memoryStore(null, true));
    const listener = vi.fn();
    library.onChange(listener);

    const result = library.import(JSON.stringify(mine));
    expect(result).toEqual({
      ok: false,
      errors: ['the browser could not save it (storage is full or blocked)'],
    });
    expect(library.charts).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('deletes imported charts only', () => {
    const store = memoryStore(JSON.stringify([mine]));
    const library = new ChartLibrary([loaded(builtIn)], store);
    expect(library.remove('mine')).toEqual({ ok: true });
    expect(library.charts.map((c) => c.id)).toEqual(['built-in']);
    expect(JSON.parse(store.text!)).toEqual([]);
    expect(() => library.remove('built-in')).toThrow('not an imported chart');
  });

  it('exports any chart as its source, indented by 2 spaces', () => {
    const library = new ChartLibrary([loaded(builtIn)], memoryStore(JSON.stringify([mine])));
    expect(library.exportText('built-in')).toBe(`${JSON.stringify(builtIn, null, 2)}\n`);
    expect(JSON.parse(library.exportText('mine'))).toEqual(mine);
    expect(() => library.exportText('missing')).toThrow('No chart with id missing');
  });

  it('skips stored imports that no longer pass, but keeps them in storage', () => {
    const broken = { ...mine, id: 'broken', bpm: -1 };
    const clash = { ...mine, id: 'built-in' };
    const store = memoryStore(JSON.stringify([broken, clash, mine]));
    const library = new ChartLibrary([loaded(builtIn)], store);

    expect(library.charts.map((c) => c.id)).toEqual(['built-in', 'mine']);
    expect(library.loadErrors).toEqual([
      'Imported chart 1: bpm must be a number greater than 0',
      'Imported chart 2: another level already uses the id "built-in"',
    ]);
    library.remove('mine');
    expect(JSON.parse(store.text!)).toEqual([broken, clash]);
  });

  it('reports saved data that is not an array of charts', () => {
    expect(new ChartLibrary([], memoryStore('{')).loadErrors[0]).toMatch(
      /^Imported charts: the saved data is not valid JSON/,
    );
    expect(new ChartLibrary([], memoryStore('{}')).loadErrors).toEqual([
      'Imported charts: the saved data is not an array',
    ]);
  });
});

describe('listErrors', () => {
  it('lists up to 5 errors, then how many more', () => {
    expect(listErrors(['a', 'b'])).toBe('a\nb');
    expect(listErrors(['1', '2', '3', '4', '5', '6', '7'])).toBe(
      '1\n2\n3\n4\n5\n…and 2 more (see the browser console)',
    );
  });
});
