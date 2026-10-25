// Chart library: the built-in charts from assets/public/charts/ plus the player's imported charts, kept in browser storage
// (doc/chart-import-export.md, ADR 0011). Keeps each chart's JSON source so any chart can be exported as loaded.
// Storage goes through a ChartStore, so unit tests can use a fake one.

import type { Chart } from '@/rhythm/chart.ts';
import { checkChartData, type LoadedChart } from './chart-loader.ts';

/** Where imported charts are kept: the JSON text of an array of chart sources */
export interface ChartStore {
  /** The saved text, or null when nothing is saved */
  read(): string | null;
  /** Throws when the browser refuses (storage full or blocked) */
  write(text: string): void;
}

export type ImportResult =
  | { ok: true; chart: Chart; replaced: boolean }
  | { ok: false; errors: string[] };

export type RemoveResult = { ok: true } | { ok: false; errors: string[] };

/** How many errors an import message box lists; the console gets them all */
export const MAX_LISTED_ERRORS = 5;

export class ChartLibrary {
  /** Problems with stored imports found at start-up, one per line, for the console */
  readonly loadErrors: string[] = [];
  private readonly builtIn: readonly LoadedChart[];
  private imported: LoadedChart[] = [];
  /** Stored entries that failed validation at start-up; written back untouched so they aren't lost */
  private readonly rejected: unknown[] = [];
  private readonly store: ChartStore;
  private readonly listeners = new Set<() => void>();

  constructor(builtIn: readonly LoadedChart[], store: ChartStore) {
    this.builtIn = builtIn;
    this.store = store;
    this.loadStored();
  }

  /** Built-in charts in index order, then imported charts in import order */
  get charts(): Chart[] {
    return [...this.builtIn, ...this.imported].map((entry) => entry.chart);
  }

  isImported(chartId: string): boolean {
    return this.imported.some((entry) => entry.chart.id === chartId);
  }

  /** The chart's JSON as loaded, indented by 2 spaces, for downloading as <id>.json */
  exportText(chartId: string): string {
    const entry = [...this.builtIn, ...this.imported].find((e) => e.chart.id === chartId);
    if (!entry) throw new Error(`No chart with id ${chartId}`);
    return `${JSON.stringify(entry.source, null, 2)}\n`;
  }

  /**
   * Imports a chart file's text: validated like a built-in chart (the id needn't match the file name).
   * A built-in id is refused; an imported id is replaced in place. Saved before it takes effect.
   */
  import(text: string): ImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      return { ok: false, errors: [`not valid JSON (${describe(error)})`] };
    }
    const checked = checkChartData(data);
    if (!checked.loaded) return { ok: false, errors: checked.errors };

    const entry = checked.loaded;
    const { id } = entry.chart;
    if (this.builtIn.some((e) => e.chart.id === id)) {
      return {
        ok: false,
        errors: [`a built-in level already uses the id "${id}"; give the chart another id`],
      };
    }
    const index = this.imported.findIndex((e) => e.chart.id === id);
    const next =
      index < 0
        ? [...this.imported, entry]
        : this.imported.map((e, i) => (i === index ? entry : e));
    const saved = this.save(next);
    if (!saved.ok) return saved;
    this.imported = next;
    this.notify();
    return { ok: true, chart: entry.chart, replaced: index >= 0 };
  }

  /** Deletes an imported chart; built-in charts can't be deleted */
  remove(chartId: string): RemoveResult {
    if (!this.isImported(chartId)) throw new Error(`Chart ${chartId} is not an imported chart`);
    const next = this.imported.filter((e) => e.chart.id !== chartId);
    const saved = this.save(next);
    if (!saved.ok) return saved;
    this.imported = next;
    this.notify();
    return { ok: true };
  }

  /** Called after every import or delete; returns a function that stops listening */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private loadStored(): void {
    const text = this.store.read();
    if (text === null) return;
    let stored: unknown;
    try {
      stored = JSON.parse(text);
    } catch (error) {
      this.loadErrors.push(
        `Imported charts: the saved data is not valid JSON (${describe(error)})`,
      );
      return;
    }
    if (!Array.isArray(stored)) {
      this.loadErrors.push('Imported charts: the saved data is not an array');
      return;
    }
    stored.forEach((data: unknown, i) => {
      const prefix = `Imported chart ${i + 1}: `;
      const checked = checkChartData(data);
      if (!checked.loaded) {
        this.loadErrors.push(...checked.errors.map((e) => prefix + e));
        this.rejected.push(data);
        return;
      }
      const { id } = checked.loaded.chart;
      if ([...this.builtIn, ...this.imported].some((e) => e.chart.id === id)) {
        this.loadErrors.push(`${prefix}another level already uses the id "${id}"`);
        this.rejected.push(data);
        return;
      }
      this.imported.push(checked.loaded);
    });
  }

  private save(imported: readonly LoadedChart[]): RemoveResult {
    try {
      this.store.write(JSON.stringify([...imported.map((e) => e.source), ...this.rejected]));
      return { ok: true };
    } catch (error) {
      console.error('Saving imported charts failed:', error);
      return {
        ok: false,
        errors: ['the browser could not save it (storage is full or blocked)'],
      };
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Up to MAX_LISTED_ERRORS errors, one per line, then how many more there are */
export function listErrors(errors: readonly string[]): string {
  const shown = errors.slice(0, MAX_LISTED_ERRORS);
  const more = errors.length - shown.length;
  if (more > 0) shown.push(`…and ${more} more (see the browser console)`);
  return shown.join('\n');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const STORAGE_KEY = 'rhythm2000s.importedCharts';

/** Imported charts in local storage. Unreadable storage (private mode etc.) counts as nothing saved, with a warning */
export function browserChartStore(): ChartStore {
  return {
    read() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (error) {
        console.warn('Imported charts could not be read from browser storage:', error);
        return null;
      }
    },
    write(text) {
      localStorage.setItem(STORAGE_KEY, text);
    },
  };
}
