// HackerEditor's commands (doc/chart-editor.md): New, Open, Save, Import, Export, Play and Test, and leaving with
// unsaved changes. Saved charts go into the chart library next to imported ones (ADR 0011), so they appear on the
// scene's play computer. Messages use the scene's own message boxes; the window and its panel are drawn by the scene.

import { listErrors, MAX_LISTED_ERRORS, type ChartLibrary } from '@/game/chart-library.ts';
import { checkChartData, type LoadedChart } from '@/game/chart-loader.ts';
import type { ChartFiles } from '@/game/chart-transfer.ts';
import { draftFromSource, draftToSource, newDraft } from '@/editor/chart-draft.ts';
import { ChartEditor } from '@/editor/chart-editor.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { SCENE_CATALOG, type SceneId } from '@/scenes/catalog.ts';
import type { ChooserItem, EditorPanelHandlers } from '@/ui/hacker-editor-panel.ts';
import type { MessageWindowOptions } from './level-scene.ts';

export interface EditorDeskHost {
  sceneId: SceneId;
  library: ChartLibrary;
  chartFiles: ChartFiles;
  showMessage(options: Omit<MessageWindowOptions, 'onClose'>): void;
  closeMessage(): void;
  /** The Open list over the editor */
  choose(title: string, items: readonly ChooserItem[], onPick: (index: number) => void): void;
  /** A note in the status line */
  note(text: string): void;
  /** Plays `chart` from phrase `phrase`; `watch` lets the computer do the responses */
  play(chart: Chart, phrase: number, watch: boolean): void;
  /** Leaves the computer for the café */
  leave(): void;
}

export class EditorDesk {
  readonly editor: ChartEditor;
  readonly handlers: EditorPanelHandlers;
  private readonly host: EditorDeskHost;
  private readonly sceneLabel: string;

  constructor(host: EditorDeskHost) {
    this.host = host;
    this.sceneLabel = SCENE_CATALOG[host.sceneId].label;
    this.editor = new ChartEditor(newDraft(host.sceneId), null);
    this.handlers = {
      onNew: () => this.confirmDiscard(() => this.editor.load(newDraft(host.sceneId), null)),
      onOpen: () => this.confirmDiscard(() => this.open()),
      onSave: () => this.save(),
      onPlay: (watch) => this.play(watch),
      onImport: () => this.confirmDiscard(() => this.importFile()),
      onExport: () => this.exportFile(),
    };
  }

  /** Esc or the close button: leaves at once, or asks first when there are unsaved changes */
  requestLeave(): void {
    if (!this.editor.dirty) {
      this.host.leave();
      return;
    }
    this.host.showMessage({
      kind: 'question',
      title: 'HackerEditor',
      message: `Leave without saving "${this.editor.draft.title}"?`,
      detail: 'Your changes since the last save will be lost.',
      confirm: { verb: 'Leave', onConfirm: () => this.host.leave() },
    });
  }

  /** Runs `then` straight away, or after the player agrees to drop unsaved changes */
  private confirmDiscard(then: () => void): void {
    if (!this.editor.dirty) {
      then();
      return;
    }
    this.host.showMessage({
      kind: 'question',
      title: 'HackerEditor',
      message: `Discard the changes to "${this.editor.draft.title}"?`,
      detail: 'They have not been saved.',
      confirm: {
        verb: 'Discard',
        onConfirm: () => {
          this.host.closeMessage();
          then();
        },
      },
    });
  }

  private open(): void {
    const { library, sceneId } = this.host;
    const charts = library.charts.filter((chart) => chart.scene === sceneId);
    const items = charts.map((chart) => ({
      label: chart.title,
      detail: library.isImported(chart.id) ? `${chart.id}.json` : `${chart.id}.json (built-in)`,
    }));
    this.host.choose(`Open a ${this.sceneLabel} level`, items, (index) => {
      const chart = charts[index]!;
      const loaded = this.validate(JSON.parse(library.exportText(chart.id)));
      if (!loaded) return;
      const draft = draftFromSource(loaded.source);
      if (library.isImported(chart.id)) {
        this.editor.load(draft, chart.id);
        this.host.note(`Opened ${chart.id}.json`);
      } else {
        // Built-in levels can't be replaced, so this is a copy that needs a file name of its own
        this.editor.load({ ...draft, id: '' }, null);
        this.host.note('Opened a copy of a built-in level: give it a file name to save it');
      }
    });
  }

  private save(): void {
    const editor = this.editor;
    const { library } = this.host;
    const problems = editor.problems;
    if (problems.length > 0) {
      this.host.showMessage({
        kind: 'error',
        title: 'Cannot Save',
        message: `"${editor.draft.title}" has ${plural(problems.length, 'problem')}.`,
        detail: `${listProblems(problems.map((p) => p.text))}\nFix them, then save again.`,
      });
      return;
    }
    const id = editor.draft.id;
    if (library.charts.some((chart) => chart.id === id) && !library.isImported(id)) {
      this.host.showMessage({
        kind: 'error',
        title: 'Cannot Save',
        message: `A built-in level already uses the file name "${id}".`,
        detail: 'Choose another file name in the Song box.',
      });
      return;
    }
    if (library.isImported(id) && id !== editor.savedId) {
      this.host.showMessage({
        kind: 'question',
        title: 'Confirm Save',
        message: `Replace the level "${id}" on the ${this.sceneLabel} computer?`,
        detail: 'Another level was saved or imported with this file name.',
        confirm: {
          verb: 'Replace',
          onConfirm: () => {
            this.host.closeMessage();
            this.write();
          },
        },
      });
      return;
    }
    this.write();
  }

  private write(): void {
    const editor = this.editor;
    const result = this.host.library.import(JSON.stringify(draftToSource(editor.draft)));
    if (!result.ok) {
      this.host.showMessage({
        kind: 'error',
        title: 'Save Failed',
        message: `"${editor.draft.title}" could not be saved.`,
        detail: listErrors(result.errors),
      });
      return;
    }
    editor.markSaved();
    this.host.note(`Saved to the ${this.sceneLabel} computer`);
  }

  private play(watch: boolean): void {
    const loaded = this.checkedDraft(watch ? 'Play' : 'Test');
    if (loaded) this.host.play(loaded.chart, this.editor.phrase, watch);
  }

  private exportFile(): void {
    const loaded = this.checkedDraft('Export');
    if (!loaded) return;
    this.host.chartFiles.save(
      `${loaded.chart.id}.json`,
      `${JSON.stringify(loaded.source, null, 2)}\n`,
    );
  }

  /** Opens a chart file in the editor; it joins the library only when saved */
  private importFile(): void {
    this.host.chartFiles.pick(
      ({ name, text }) => {
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch (error) {
          this.importFailed(name, [
            `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
          ]);
          return;
        }
        const checked = checkChartData(data);
        if (!checked.loaded) {
          this.importFailed(name, checked.errors);
          return;
        }
        const { source } = checked.loaded;
        if (source.scene !== this.host.sceneId) {
          const label = SCENE_CATALOG[source.scene as SceneId].label;
          this.importFailed(name, [`it is a ${label} level; open it in the ${label} HackerEditor`]);
          return;
        }
        const { library } = this.host;
        this.editor.load(draftFromSource(source), library.isImported(source.id) ? source.id : null);
        this.host.note(`Opened ${name}`);
      },
      (error) => this.importFailed('The file', [error]),
    );
  }

  private importFailed(name: string, errors: readonly string[]): void {
    for (const error of errors) console.error(`Import ${name}: ${error}`);
    this.host.showMessage({
      kind: 'error',
      title: 'Import Failed',
      message: `${name} could not be opened.`,
      detail: listErrors(errors),
    });
  }

  /** The draft as a validated chart, or null after telling the player what to fix first */
  private checkedDraft(what: string): LoadedChart | null {
    const problems = this.editor.problems;
    if (problems.length === 0) {
      const loaded = this.validate(draftToSource(this.editor.draft));
      if (loaded) return loaded;
    }
    this.host.showMessage({
      kind: 'error',
      title: `Cannot ${what}`,
      message: `"${this.editor.draft.title}" has ${plural(problems.length, 'problem')}.`,
      detail: `${listProblems(problems.map((p) => p.text))}\nFix them first.`,
    });
    return null;
  }

  private validate(data: unknown): LoadedChart | null {
    const checked = checkChartData(data);
    for (const error of checked.errors) console.error(`HackerEditor: ${error}`);
    return checked.loaded;
  }
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The first problems, one per line; the rest are in the editor's Problems box */
function listProblems(problems: readonly string[]): string {
  const shown = problems.slice(0, MAX_LISTED_ERRORS);
  const more = problems.length - shown.length;
  if (more > 0) shown.push(`…and ${more} more (see the Problems box)`);
  return shown.join('\n');
}
