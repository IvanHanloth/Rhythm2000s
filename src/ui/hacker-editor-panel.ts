// HackerEditor's contents (doc/chart-editor.md "Window"): a toolbar, the phrase list and song properties on the left,
// the selected phrase's call and response lanes, the action palette and the problems on the right, and a status line.
// Buttons, fields, group boxes, text and action icons come from each scene in its native style, like the settings
// panel (src/ui/settings-panel.ts). Every edit goes through the ChartEditor, and the panel redraws from it.
// Top-left at (0, 0).

import { Container, type FederatedPointerEvent, Graphics, Rectangle, type Text } from 'pixi.js';
import {
  type ChartEditor,
  gridBeats,
  type Lane,
  snapBeat,
  SNAP_STEPS,
  type SnapStep,
} from '@/editor/chart-editor.ts';
import { type ChartDraft, draftToSource, type SongField } from '@/editor/chart-draft.ts';
import { ACTION_LABELS, type ActionType, lastTapOffset } from '@/rhythm/actions.ts';
import { buildChart } from '@/rhythm/chart.ts';
import type { PanelTextStyle } from './results-panel.ts';
import type { CheckBoxWidget } from './settings-panel.ts';
import type { TextEntry } from './text-entry.ts';

export interface EditorButton {
  view: Container;
  width: number;
  height: number;
  setEnabled(enabled: boolean): void;
}

/** A button that stays pressed while on (the snap steps, the palette's actions) */
export interface ToggleWidget {
  view: Container;
  width: number;
  height: number;
  setOn(on: boolean): void;
}

/** A one-line text box; the panel feeds it the text and whether it is being typed in */
export interface FieldWidget {
  view: Container;
  height: number;
  setText(text: string, editing: boolean): void;
}

export interface EditorColors {
  /** Lane and list background */
  window: string;
  ink: string;
  muted: string;
  /** Lane borders and snap lines */
  line: string;
  /** Beat lines */
  beat: string;
  selection: string;
  onSelection: string;
  /** Event blocks in the call and response lanes */
  call: string;
  response: string;
  /** Marks on events and phrases with problems */
  problem: string;
}

/** Widgets and colours each scene supplies in its native style */
export interface EditorKit {
  text(text: string, style: PanelTextStyle): Text;
  groupBox(title: string, width: number, height: number): { view: Container; inner: Container };
  /** Width and height taken by the group box padding (left + right, top + bottom) */
  groupInset: { x: number; y: number };
  /** A push button `width` wide (sized to its label when omitted) */
  button(label: string, onTap: () => void, width?: number): EditorButton;
  /** A toggle button `width` wide with an optional icon before its label */
  toggle(label: string, icon: Container | null, width: number, onTap: () => void): ToggleWidget;
  checkBox(label: string, onToggle: () => void): CheckBoxWidget;
  /** A text box `width` wide; onPress is called when it is clicked */
  field(width: number, onPress: () => void): FieldWidget;
  /** The widget icon of an action, `size` px square */
  actionIcon(action: ActionType, size: number): Container;
  colors: EditorColors;
  /** Ellipsis for buttons that open something ("..." on XP, "…" on the Mac) */
  ellipsis: string;
  /** The modifier key's name in hints ("Ctrl" / "⌘") */
  commandKey: string;
  textSize: number;
}

export interface EditorPanelHandlers {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  /** Plays from the selected phrase: `watch` lets the computer do the responses */
  onPlay(watch: boolean): void;
  onImport(): void;
  onExport(): void;
}

export interface EditorPanelOptions {
  editor: ChartEditor;
  /** The scene's actions, in palette order */
  actions: readonly ActionType[];
  width: number;
  height: number;
  kit: EditorKit;
  textEntry: TextEntry;
  handlers: EditorPanelHandlers;
  /** After every redraw, e.g. to put the chart's title in the window's title bar */
  onRefresh: () => void;
}

/** One entry of the Open list */
export interface ChooserItem {
  label: string;
  detail: string;
}

const TOOLBAR_HEIGHT = 26;
const GAP = 8;
const LEFT_WIDTH = 236;
const ROW_HEIGHT = 22;
/** Song fields holding numbers, which get − and + buttons */
type NumberField = Exclude<SongField, 'title' | 'id'>;
type SongRow =
  | { field: 'title' | 'id'; label: string }
  | { field: NumberField; label: string; step: number; min: number };
const SONG_ROWS: readonly SongRow[] = [
  { field: 'title', label: 'Title' },
  { field: 'id', label: 'File name' },
  { field: 'bpm', label: 'BPM', step: 1, min: 1 },
  { field: 'beatsPerBar', label: 'Beats per bar', step: 1, min: 1 },
  { field: 'countInBars', label: 'Count-in bars', step: 1, min: 0 },
  { field: 'outroBars', label: 'Outro bars', step: 1, min: 0 },
  { field: 'gap', label: 'Gap (beats)', step: 0.5, min: 0 },
];
const LABEL_COLUMN = 80;
const LANE_HEIGHT = 40;
const EVENT_SIZE = 20;
const ICON_SIZE = 16;
const PALETTE_COLUMNS = 4;
const PALETTE_ROW = 26;
const PROBLEM_LINES = 5;
const MAX_FIELD_LENGTH = 60;

type Drag = { lane: Lane; index: number; beat: number; moved: boolean };

export class HackerEditorPanel {
  readonly view = new Container({ label: 'hacker-editor' });
  private readonly editor: ChartEditor;
  private readonly kit: EditorKit;
  private readonly entry: TextEntry;
  private readonly handlers: EditorPanelHandlers;
  private readonly onRefresh: () => void;
  private readonly actions: readonly ActionType[];
  private readonly width: number;
  private readonly height: number;
  private readonly undoButton: EditorButton;
  private readonly redoButton: EditorButton;
  private readonly snapToggles: ToggleWidget[] = [];
  private readonly paletteToggles: ToggleWidget[] = [];
  /** Redrawn on every refresh */
  private readonly phraseList = new Container({ label: 'phrase-list' });
  private readonly songFields = new Map<SongField, FieldWidget>();
  private readonly phraseHeader = new Container({ label: 'phrase-header' });
  private readonly phraseTitle: Text;
  private readonly lanes = new Container({ label: 'lanes' });
  private readonly problemList = new Container({ label: 'problems' });
  private readonly problemTitle: Text;
  private readonly status: Text;
  private readonly phraseGapCheck: CheckBoxWidget;
  private readonly phraseGapField: FieldWidget;
  private readonly resetButton: EditorButton;
  private chooser: Container | null = null;
  private snap: SnapStep = SNAP_STEPS[0];
  private tool: ActionType;
  private listTop = 0;
  private listRows = 0;
  private laneWidth = 0;
  private drag: Drag | null = null;
  /** The field being typed in */
  private editing: { key: string; text: string } | null = null;
  private note: string | null = null;

  constructor({
    editor,
    actions,
    width,
    height,
    kit,
    textEntry,
    handlers,
    onRefresh,
  }: EditorPanelOptions) {
    this.editor = editor;
    this.onRefresh = onRefresh;
    this.kit = kit;
    this.entry = textEntry;
    this.handlers = handlers;
    this.actions = actions;
    this.width = width;
    this.height = height;
    const first = actions[0];
    if (!first) throw new Error('HackerEditor needs at least one action');
    this.tool = first;

    const size = kit.textSize;
    const statusHeight = size + 6;
    const bodyTop = TOOLBAR_HEIGHT + GAP;
    const bodyHeight = height - bodyTop - statusHeight - GAP;

    // ---- Toolbar ----
    const toolbar = new Container({ label: 'toolbar' });
    let x = 0;
    const add = (view: Container, w: number, gapAfter = 4) => {
      view.x = x;
      toolbar.addChild(view);
      x += w + gapAfter;
    };
    const tool = (label: string, onTap: () => void, gapAfter?: number) => {
      const button = kit.button(label, onTap);
      add(button.view, button.width, gapAfter);
      return button;
    };
    tool('New', () => this.run(() => handlers.onNew()));
    tool(`Open${kit.ellipsis}`, () => this.run(() => handlers.onOpen()));
    tool('Save', () => this.run(() => handlers.onSave()), 14);
    this.undoButton = tool('Undo', () => this.run(() => editor.undo()));
    this.redoButton = tool('Redo', () => this.run(() => editor.redo()), 14);
    tool('Play', () => this.run(() => handlers.onPlay(true)));
    tool('Test', () => this.run(() => handlers.onPlay(false)), 14);
    const snapLabel = kit.text('Snap:', { size });
    snapLabel.anchor.set(0, 0.5);
    snapLabel.y = 11;
    add(snapLabel, Math.ceil(snapLabel.width), 6);
    for (const step of SNAP_STEPS) {
      const toggle = kit.toggle(`1/${1 / step}`, null, 38, () => {
        this.snap = step;
        this.refresh();
      });
      add(toggle.view, toggle.width);
      this.snapToggles.push(toggle);
    }
    x += 10;
    tool(`Import${kit.ellipsis}`, () => this.run(() => handlers.onImport()));
    tool(`Export${kit.ellipsis}`, () => this.run(() => handlers.onExport()));
    this.view.addChild(toolbar);

    // ---- Left: phrases and song ----
    const songHeight = SONG_ROWS.length * ROW_HEIGHT + kit.groupInset.y + 4;
    const phrasesHeight = bodyHeight - songHeight - GAP;
    const phrases = kit.groupBox('Phrases', LEFT_WIDTH, phrasesHeight);
    phrases.view.position.set(0, bodyTop);
    const innerLeft = LEFT_WIDTH - kit.groupInset.x;
    const phraseButtons = new Container({ label: 'phrase-buttons' });
    let bx = 0;
    const buttonWidth = Math.floor((innerLeft - 4 * 3) / 5);
    for (const [label, action] of [
      ['Add', () => editor.addPhrase()],
      ['Copy', () => editor.duplicatePhrase()],
      ['Delete', () => editor.deletePhrase()],
      ['Up', () => editor.movePhrase(-1)],
      ['Down', () => editor.movePhrase(1)],
    ] as const) {
      const button = kit.button(label, () => this.run(action), buttonWidth);
      button.view.x = bx;
      bx += buttonWidth + 3;
      phraseButtons.addChild(button.view);
    }
    const listHeight = phrasesHeight - kit.groupInset.y - ROW_HEIGHT - 6;
    this.listRows = Math.max(1, Math.floor(listHeight / ROW_HEIGHT));
    phraseButtons.y = this.listRows * ROW_HEIGHT + 6;
    this.phraseList.eventMode = 'static';
    this.phraseList.hitArea = new Rectangle(0, 0, innerLeft, this.listRows * ROW_HEIGHT);
    this.phraseList.on('wheel', (event) => {
      this.listTop += Math.sign(event.deltaY);
      this.refresh();
    });
    phrases.inner.addChild(this.phraseList, phraseButtons);

    const song = kit.groupBox('Song', LEFT_WIDTH, songHeight);
    song.view.position.set(0, bodyTop + phrasesHeight + GAP);
    const fieldLeft = 84;
    SONG_ROWS.forEach((row, i) => {
      const y = i * ROW_HEIGHT;
      const label = kit.text(row.label, { size });
      label.anchor.set(0, 0.5);
      label.position.set(0, y + 10);
      const spin = 'step' in row;
      const fieldWidth = innerLeft - fieldLeft - (spin ? 44 : 0);
      const field = kit.field(fieldWidth, () => this.beginSongEdit(row.field));
      field.view.position.set(fieldLeft, y);
      song.inner.addChild(label, field.view);
      this.songFields.set(row.field, field);
      if ('step' in row) {
        const { field: name, step, min } = row;
        const less = kit.button('−', () => this.run(() => this.nudgeSong(name, -step, min)), 20);
        const more = kit.button('+', () => this.run(() => this.nudgeSong(name, step, min)), 20);
        less.view.position.set(fieldLeft + fieldWidth + 2, y);
        more.view.position.set(fieldLeft + fieldWidth + 24, y);
        song.inner.addChild(less.view, more.view);
      }
    });
    this.view.addChild(phrases.view, song.view);

    // ---- Right: phrase lanes, palette, problems ----
    const rightX = LEFT_WIDTH + GAP;
    const rightWidth = width - rightX;
    const innerRight = rightWidth - kit.groupInset.x;
    const laneBlock = ROW_HEIGHT + 4 + 14 + LANE_HEIGHT * 2 + 6;
    const phraseHeight = laneBlock + kit.groupInset.y;
    const paletteRows = Math.ceil(actions.length / PALETTE_COLUMNS);
    const paletteHeight = paletteRows * PALETTE_ROW + kit.groupInset.y - 2;
    const problemsHeight = bodyHeight - phraseHeight - paletteHeight - GAP * 2;

    const phrase = kit.groupBox('Phrase', rightWidth, phraseHeight);
    phrase.view.position.set(rightX, bodyTop);
    this.phraseTitle = kit.text('', { size, bold: true });
    this.phraseTitle.anchor.set(0, 0.5);
    this.phraseTitle.y = 10;
    this.phraseGapCheck = kit.checkBox('Own gap', () =>
      this.run(() => {
        const gap = editor.draft.phrases[editor.phrase]!.gap;
        editor.setPhraseGap(gap === null ? editor.draft.gap : null);
      }),
    );
    this.phraseGapCheck.view.position.set(96, 10 - this.phraseGapCheck.height / 2);
    this.phraseGapField = kit.field(48, () => this.beginPhraseGapEdit());
    this.phraseGapField.view.position.set(176, 0);
    const gapLess = kit.button('−', () => this.run(() => this.nudgePhraseGap(-0.5)), 20);
    const gapMore = kit.button('+', () => this.run(() => this.nudgePhraseGap(0.5)), 20);
    gapLess.view.position.set(226, 0);
    gapMore.view.position.set(248, 0);
    const beatsLabel = kit.text('beats', { size, color: kit.colors.muted });
    beatsLabel.anchor.set(0, 0.5);
    beatsLabel.position.set(274, 10);
    this.resetButton = kit.button('Reset to call', () => this.run(() => editor.resetResponse()));
    this.resetButton.view.position.set(innerRight - this.resetButton.width, 0);
    this.phraseHeader.addChild(
      this.phraseTitle,
      this.phraseGapCheck.view,
      this.phraseGapField.view,
      gapLess.view,
      gapMore.view,
      beatsLabel,
      this.resetButton.view,
    );
    this.lanes.y = ROW_HEIGHT + 4;
    this.laneWidth = innerRight;
    phrase.inner.addChild(this.phraseHeader, this.lanes);

    const palette = kit.groupBox('Actions', rightWidth, paletteHeight);
    palette.view.position.set(rightX, bodyTop + phraseHeight + GAP);
    const toggleWidth = Math.floor((innerRight - (PALETTE_COLUMNS - 1) * 4) / PALETTE_COLUMNS);
    actions.forEach((action, i) => {
      const toggle = kit.toggle(
        ACTION_LABELS[action],
        kit.actionIcon(action, ICON_SIZE),
        toggleWidth,
        () => this.run(() => (this.tool = action)),
      );
      toggle.view.position.set(
        (i % PALETTE_COLUMNS) * (toggleWidth + 4),
        Math.floor(i / PALETTE_COLUMNS) * PALETTE_ROW,
      );
      palette.inner.addChild(toggle.view);
      this.paletteToggles.push(toggle);
    });

    const problems = kit.groupBox('Problems', rightWidth, problemsHeight);
    problems.view.position.set(rightX, bodyTop + phraseHeight + paletteHeight + GAP * 2);
    this.problemTitle = kit.text('', { size, color: kit.colors.muted });
    problems.inner.addChild(this.problemTitle, this.problemList);
    this.problemList.y = 0;
    this.view.addChild(phrase.view, palette.view, problems.view);

    this.status = kit.text('', { size, color: kit.colors.muted });
    this.status.position.set(0, height - statusHeight + 2);
    this.view.addChild(this.status);

    // A click on the panel's face ends typing in a field
    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(0, 0, width, height);
    this.view.on('pointerdown', (event) => {
      if (event.target === this.view) this.entry.commit();
    });
    this.refresh();
  }

  /** A short note in the status line until the next edit, e.g. "Saved." */
  setNote(note: string | null): void {
    this.note = note;
    this.refresh();
  }

  /**
   * Keys while the editor is in front: Delete removes the selected action, ← → move it by one snap step,
   * ↑ ↓ pick the phrase, Ctrl+Z / Ctrl+Y undo and redo, Ctrl+S saves. True when the key was used.
   */
  onKeyDown(event: KeyboardEvent): boolean {
    if (this.chooser) return false;
    const command = event.ctrlKey || event.metaKey;
    const editor = this.editor;
    if (command) {
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) this.run(() => editor.undo());
      else if (key === 'y' || (key === 'z' && event.shiftKey)) this.run(() => editor.redo());
      else if (key === 's') this.run(() => this.handlers.onSave());
      else return false;
      return true;
    }
    switch (event.code) {
      case 'Delete':
      case 'Backspace':
        this.run(() => editor.removeSelected());
        return true;
      case 'ArrowUp':
      case 'ArrowDown': {
        const p = editor.phrase + (event.code === 'ArrowUp' ? -1 : 1);
        if (p >= 0 && p < editor.draft.phrases.length) this.run(() => editor.selectPhrase(p));
        return true;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const selection = editor.selection;
        if (!selection) return true;
        const event_ = editor.draft.phrases[editor.phrase]!.events[selection.index]!;
        const from = selection.lane === 'call' ? event_.call : event_.response;
        const to = snapBeat(
          from + (event.code === 'ArrowLeft' ? -this.snap : this.snap),
          this.snap,
          editor.draft.beatsPerBar,
        );
        if (to !== from) this.run(() => editor.moveEvent(selection.lane, selection.index, to));
        return true;
      }
    }
    return false;
  }

  /** Esc: closes the Open list or ends typing; false when there was nothing to close */
  onEscape(): boolean {
    if (this.chooser) {
      this.closeChooser();
      return true;
    }
    return false;
  }

  /** The Open list over the editor: pick a chart, or Cancel */
  showChooser(title: string, items: readonly ChooserItem[], onPick: (index: number) => void): void {
    this.closeChooser();
    const kit = this.kit;
    const width = 420;
    const rows = Math.min(items.length, 10);
    const height = kit.groupInset.y + Math.max(rows, 1) * ROW_HEIGHT + 40;
    const shade = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill({ color: kit.colors.window, alpha: 0.6 });
    shade.eventMode = 'static';
    const box = kit.groupBox(title, width, height);
    const backing = new Graphics().rect(0, 0, width, height).fill(kit.colors.window);
    const holder = new Container({ label: 'chooser' });
    holder.position.set(
      Math.round((this.width - width) / 2),
      Math.round((this.height - height) / 3),
    );
    holder.addChild(backing, box.view);
    const inner = width - kit.groupInset.x;
    if (items.length === 0) {
      box.inner.addChild(kit.text('No levels on this computer yet.', { size: kit.textSize }));
    }
    items.slice(0, rows).forEach((item, i) => {
      const row = new Container({ label: `chooser-${i}` });
      row.y = i * ROW_HEIGHT;
      const back = new Graphics().rect(0, 0, inner, ROW_HEIGHT - 2).fill(kit.colors.selection);
      back.visible = false;
      const label = kit.text(item.label, { size: kit.textSize });
      label.anchor.set(0, 0.5);
      label.position.set(4, (ROW_HEIGHT - 2) / 2);
      const detail = kit.text(item.detail, { size: kit.textSize, color: kit.colors.muted });
      detail.anchor.set(1, 0.5);
      detail.position.set(inner - 4, (ROW_HEIGHT - 2) / 2);
      row.addChild(back, label, detail);
      row.eventMode = 'static';
      row.hitArea = new Rectangle(0, 0, inner, ROW_HEIGHT - 2);
      row.on('pointerover', () => (back.visible = true));
      row.on('pointerout', () => (back.visible = false));
      row.on('pointertap', () => {
        this.closeChooser();
        onPick(i);
      });
      box.inner.addChild(row);
    });
    const cancel = kit.button('Cancel', () => this.closeChooser());
    cancel.view.position.set(inner - cancel.width, Math.max(rows, 1) * ROW_HEIGHT + 8);
    box.inner.addChild(cancel.view);
    const layer = new Container({ label: 'chooser-layer' });
    layer.addChild(shade, holder);
    this.view.addChild(layer);
    this.chooser = layer;
  }

  /** Redraws everything that follows the chart and the selection */
  refresh(): void {
    const editor = this.editor;
    const draft = editor.draft;
    this.undoButton.setEnabled(editor.canUndo);
    this.redoButton.setEnabled(editor.canRedo);
    this.snapToggles.forEach((toggle, i) => toggle.setOn(SNAP_STEPS[i] === this.snap));
    this.paletteToggles.forEach((toggle, i) => toggle.setOn(this.actions[i] === this.tool));
    this.drawPhraseList(draft);
    for (const row of SONG_ROWS) {
      const editing = this.editing?.key === row.field;
      const text = editing ? this.editing!.text : String(draft[row.field]);
      this.songFields.get(row.field)!.setText(text, editing);
    }
    const phrase = draft.phrases[editor.phrase]!;
    this.phraseTitle.text = `Phrase ${editor.phrase + 1}`;
    this.phraseGapCheck.setChecked(phrase.gap !== null);
    const gapEditing = this.editing?.key === 'phrase-gap';
    this.phraseGapField.setText(
      gapEditing ? this.editing!.text : String(phrase.gap ?? draft.gap),
      gapEditing,
    );
    this.phraseGapField.view.alpha = phrase.gap === null ? 0.5 : 1;
    this.resetButton.setEnabled(phrase.ownResponse);
    this.drawLanes(draft);
    this.drawProblems();
    this.drawStatus(draft);
    this.onRefresh();
  }

  destroy(): void {
    this.entry.commit();
    this.view.destroy({ children: true });
  }

  // ---------- Editing ----------

  /** Runs an edit or command, then redraws; the status note is cleared by any edit */
  private run(action: () => void): void {
    this.entry.commit();
    this.note = null;
    action();
    this.refresh();
  }

  private nudgeSong(field: NumberField, by: number, min: number): void {
    this.editor.setSong(field, Math.max(min, this.editor.draft[field] + by));
  }

  private nudgePhraseGap(by: number): void {
    const editor = this.editor;
    const gap = editor.draft.phrases[editor.phrase]!.gap ?? editor.draft.gap;
    editor.setPhraseGap(Math.max(0, gap + by));
  }

  private beginSongEdit(field: SongField): void {
    const editor = this.editor;
    this.beginEdit(field, String(editor.draft[field]), (text) => {
      if (field === 'title') {
        if (text.trim() !== '') editor.setSong('title', text);
      } else if (field === 'id') {
        editor.setSong('id', text.trim());
      } else {
        const value = Number(text);
        if (text.trim() !== '' && Number.isFinite(value)) editor.setSong(field, value);
      }
    });
  }

  private beginPhraseGapEdit(): void {
    const editor = this.editor;
    const phrase = editor.draft.phrases[editor.phrase]!;
    this.beginEdit('phrase-gap', String(phrase.gap ?? editor.draft.gap), (text) => {
      const value = Number(text);
      if (text.trim() !== '' && Number.isFinite(value)) editor.setPhraseGap(value);
    });
  }

  /** Types into the field `key`; `commit` gets the text on Enter or when the field loses focus */
  private beginEdit(key: string, text: string, commit: (text: string) => void): void {
    this.editing = { key, text };
    this.entry.begin(
      text,
      {
        onInput: (typed) => {
          this.editing = { key, text: typed };
          this.refresh();
        },
        onCommit: (typed) => {
          this.editing = null;
          this.note = null;
          commit(typed);
          this.refresh();
        },
        onCancel: () => {
          this.editing = null;
          this.refresh();
        },
      },
      MAX_FIELD_LENGTH,
    );
    this.refresh();
  }

  private closeChooser(): void {
    this.chooser?.destroy({ children: true });
    this.chooser = null;
  }

  // ---------- Drawing ----------

  private drawPhraseList(draft: ChartDraft): void {
    const { kit, editor } = this;
    const list = this.phraseList;
    for (const child of list.removeChildren()) child.destroy({ children: true });
    const count = draft.phrases.length;
    // Keep the selected phrase in view
    if (editor.phrase < this.listTop) this.listTop = editor.phrase;
    if (editor.phrase >= this.listTop + this.listRows)
      this.listTop = editor.phrase - this.listRows + 1;
    this.listTop = Math.max(0, Math.min(this.listTop, count - this.listRows));
    const width = LEFT_WIDTH - kit.groupInset.x;
    const troubled = new Set(editor.problems.map((p) => p.phrase));
    const background = new Graphics()
      .rect(0, 0, width, this.listRows * ROW_HEIGHT)
      .fill(kit.colors.window)
      .stroke({ width: 1, color: kit.colors.line, alignment: 1 });
    list.addChild(background);
    for (let i = this.listTop; i < Math.min(count, this.listTop + this.listRows); i++) {
      const row = new Container({ label: `phrase-${i}` });
      row.y = (i - this.listTop) * ROW_HEIGHT;
      const selected = i === editor.phrase;
      if (selected) {
        row.addChild(
          new Graphics().rect(1, 1, width - 2, ROW_HEIGHT - 2).fill(kit.colors.selection),
        );
      }
      const color = selected ? kit.colors.onSelection : kit.colors.ink;
      const label = kit.text(`${i + 1}`, { size: kit.textSize, color, bold: selected });
      label.anchor.set(1, 0.5);
      label.position.set(22, ROW_HEIGHT / 2);
      row.addChild(label);
      const icons = draft.phrases[i]!.events.slice(0, 10);
      icons.forEach((event, j) => {
        const icon = kit.actionIcon(event.action, 14);
        icon.position.set(30 + j * 16, (ROW_HEIGHT - 14) / 2);
        row.addChild(icon);
      });
      if (draft.phrases[i]!.events.length === 0) {
        const empty = kit.text('(empty)', {
          size: kit.textSize,
          color: selected ? color : kit.colors.muted,
        });
        empty.anchor.set(0, 0.5);
        empty.position.set(30, ROW_HEIGHT / 2);
        row.addChild(empty);
      }
      if (troubled.has(i)) {
        const mark = kit.text('!', { size: kit.textSize, bold: true, color: kit.colors.problem });
        mark.anchor.set(1, 0.5);
        mark.position.set(width - 6, ROW_HEIGHT / 2);
        row.addChild(mark);
      }
      row.eventMode = 'static';
      row.hitArea = new Rectangle(0, 0, width, ROW_HEIGHT);
      row.on('pointertap', () => this.run(() => editor.selectPhrase(i)));
      list.addChild(row);
    }
  }

  private drawLanes(draft: ChartDraft): void {
    const { kit, editor } = this;
    const lanes = this.lanes;
    for (const child of lanes.removeChildren()) child.destroy({ children: true });
    const phrase = draft.phrases[editor.phrase]!;
    const bar = draft.beatsPerBar;
    const gridLeft = LABEL_COLUMN;
    const gridWidth = this.laneWidth - gridLeft - 4;
    const beatWidth = gridWidth / bar;
    const xOf = (beat: number) => gridLeft + beat * beatWidth;
    const problems = editor.problems.filter((p) => p.phrase === editor.phrase && p.event);

    // Beat numbers
    for (let beat = 0; beat < bar; beat++) {
      const number = kit.text(`${beat + 1}`, { size: kit.textSize - 1, color: kit.colors.muted });
      number.anchor.set(0.5, 0);
      number.position.set(xOf(beat), 0);
      lanes.addChild(number);
    }

    (['call', 'response'] as const).forEach((lane, l) => {
      const top = 16 + l * (LANE_HEIGHT + 6);
      const label = kit.text(lane === 'call' ? 'Call' : 'Response', {
        size: kit.textSize,
        bold: true,
      });
      label.anchor.set(0, 0.5);
      label.position.set(0, top + LANE_HEIGHT / 2);
      lanes.addChild(label);
      const grid = new Graphics()
        .rect(gridLeft - 12, top, gridWidth + 16, LANE_HEIGHT)
        .fill(kit.colors.window)
        .stroke({ width: 1, color: kit.colors.line, alignment: 1 });
      for (const beat of gridBeats(bar, this.snap)) {
        const whole = Number.isInteger(beat);
        grid
          .moveTo(Math.round(xOf(beat)) + 0.5, top + (whole ? 2 : 10))
          .lineTo(Math.round(xOf(beat)) + 0.5, top + LANE_HEIGHT - (whole ? 2 : 10))
          .stroke({ width: 1, color: whole ? kit.colors.beat : kit.colors.line });
      }
      lanes.addChild(grid);

      const area = new Container({ label: `${lane}-lane` });
      area.eventMode = 'static';
      area.hitArea = new Rectangle(gridLeft - 12, top, gridWidth + 16, LANE_HEIGHT);
      area.cursor = 'default';
      area.on('pointerdown', (event: FederatedPointerEvent) =>
        this.pressLane(lane, event, xOf, beatWidth),
      );
      lanes.addChild(area);

      phrase.events.forEach((event, i) => {
        const dragging = this.drag?.lane === lane && this.drag.index === i ? this.drag : null;
        const beat = dragging ? dragging.beat : lane === 'call' ? event.call : event.response;
        const selected = editor.selection?.lane === lane && editor.selection.index === i;
        const troubled = problems.some((p) => p.event?.lane === lane && p.event.index === i);
        area.addChild(
          this.eventBlock(event.action, xOf(beat), top, beatWidth, lane, selected, troubled),
        );
      });
    });
  }

  /** An event in a lane: its icon on the beat, with a bar out to its last press for multi-press actions */
  private eventBlock(
    action: ActionType,
    x: number,
    top: number,
    beatWidth: number,
    lane: Lane,
    selected: boolean,
    troubled: boolean,
  ): Container {
    const { kit } = this;
    const block = new Container({ label: `event-${action}` });
    const middle = top + LANE_HEIGHT / 2;
    const span = lastTapOffset(action) * beatWidth;
    const fill = lane === 'call' ? kit.colors.call : kit.colors.response;
    const g = new Graphics();
    if (span > 0) {
      g.roundRect(x, middle - 4, span, 8, 4).fill({ color: fill, alpha: 0.45 });
      g.circle(x + span, middle, 4).fill(fill);
    }
    const half = EVENT_SIZE / 2;
    g.roundRect(x - half, middle - half, EVENT_SIZE, EVENT_SIZE, 3).fill(fill);
    if (selected || troubled) {
      g.roundRect(x - half - 2, middle - half - 2, EVENT_SIZE + 4, EVENT_SIZE + 4, 4).stroke({
        width: 2,
        color: troubled ? kit.colors.problem : kit.colors.selection,
      });
    }
    const icon = kit.actionIcon(action, ICON_SIZE);
    icon.position.set(x - ICON_SIZE / 2, middle - ICON_SIZE / 2);
    block.addChild(g, icon);
    return block;
  }

  /**
   * A press in a lane: on an event it selects it and starts dragging it along the grid; on an empty spot of the call
   * lane it places the palette's action there; elsewhere it clears the selection.
   */
  private pressLane(
    lane: Lane,
    event: FederatedPointerEvent,
    xOf: (beat: number) => number,
    beatWidth: number,
  ): void {
    this.entry.commit();
    const editor = this.editor;
    const phrase = editor.draft.phrases[editor.phrase]!;
    const x = event.getLocalPosition(this.lanes).x;
    const beatAt = (px: number) =>
      snapBeat((px - xOf(0)) / beatWidth, this.snap, editor.draft.beatsPerBar);
    const hit = phrase.events.findIndex(
      (e) => Math.abs(xOf(lane === 'call' ? e.call : e.response) - x) <= EVENT_SIZE / 2 + 2,
    );
    this.note = null;
    if (hit < 0) {
      if (lane === 'call') editor.place(beatAt(x), this.tool);
      else editor.selectEvent(null);
      this.refresh();
      return;
    }
    editor.selectEvent({ lane, index: hit });
    const start = lane === 'call' ? phrase.events[hit]!.call : phrase.events[hit]!.response;
    if (lane === 'call') this.tool = phrase.events[hit]!.action;
    this.drag = { lane, index: hit, beat: start, moved: false };
    // The lanes are redrawn while dragging, so follow the pointer on the panel, which stays
    const move = (e: FederatedPointerEvent) => {
      const drag = this.drag;
      if (!drag) return;
      const beat = beatAt(e.getLocalPosition(this.lanes).x);
      if (beat === drag.beat) return;
      drag.beat = beat;
      drag.moved = true;
      this.drawLanes(editor.draft);
    };
    const end = () => {
      this.view.off('globalpointermove', move);
      this.view.off('pointerup', end);
      this.view.off('pointerupoutside', end);
      const drag = this.drag;
      this.drag = null;
      if (drag?.moved && drag.beat !== start) editor.moveEvent(drag.lane, drag.index, drag.beat);
      this.refresh();
    };
    this.view.on('globalpointermove', move);
    this.view.on('pointerup', end);
    this.view.on('pointerupoutside', end);
    this.refresh();
  }

  private drawProblems(): void {
    const { kit, editor } = this;
    const list = this.problemList;
    for (const child of list.removeChildren()) child.destroy({ children: true });
    const problems = editor.problems;
    this.problemTitle.visible = problems.length === 0;
    this.problemTitle.text = 'No problems: the level can be saved and played.';
    const shown = problems.slice(0, PROBLEM_LINES);
    const lineHeight = kit.textSize + 4;
    shown.forEach((problem, i) => {
      const row = new Container({ label: `problem-${i}` });
      row.y = i * lineHeight;
      const mark = kit.text('!', { size: kit.textSize, bold: true, color: kit.colors.problem });
      const text = kit.text(problem.text, { size: kit.textSize });
      text.x = 12;
      row.addChild(mark, text);
      if (problem.phrase !== null) {
        const p = problem.phrase;
        row.eventMode = 'static';
        row.cursor = 'pointer';
        row.on('pointertap', () =>
          this.run(() => {
            editor.selectPhrase(p);
            editor.selectEvent(problem.event);
          }),
        );
      }
      list.addChild(row);
    });
    if (problems.length > PROBLEM_LINES) {
      const more = kit.text(`…and ${problems.length - PROBLEM_LINES} more`, {
        size: kit.textSize,
        color: kit.colors.muted,
      });
      more.y = PROBLEM_LINES * lineHeight;
      list.addChild(more);
    }
  }

  private drawStatus(draft: ChartDraft): void {
    const editor = this.editor;
    const chart = buildChart(draftToSource(draft));
    const seconds = Math.round((chart.endBeat * 60) / draft.bpm);
    const length = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const count = editor.problems.length;
    const parts = [
      `${draft.phrases.length} phrase${draft.phrases.length === 1 ? '' : 's'}`,
      length,
      count === 0 ? 'no problems' : `${count} problem${count === 1 ? '' : 's'}`,
      editor.dirty ? 'not saved' : 'saved',
    ];
    if (this.note) parts.push(this.note);
    const key = this.kit.commandKey;
    this.status.text = `${parts.join(' · ')}        Click the Call lane to place · Delete removes · ${key}+Z undo · ${key}+S save · Esc: back to the café`;
  }
}
