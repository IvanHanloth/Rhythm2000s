// HackerEditor's editing state (doc/chart-editor.md): the draft, undo and redo, the selected phrase and event, and the
// chart's problems, checked on every change with the same validation as loading and importing. No PixiJS.

import { checkChartData } from '@/game/chart-loader.ts';
import type { ActionType } from '@/rhythm/actions.ts';
import {
  addPhrase,
  type ChartDraft,
  deletePhrase,
  draftToSource,
  duplicatePhrase,
  moveCallEvent,
  movePhrase,
  moveResponseEvent,
  phraseAt,
  placeEvent,
  removeEvent,
  resetResponse,
  setPhraseGap,
  setSongField,
  type SongField,
} from './chart-draft.ts';

export type Lane = 'call' | 'response';

export interface EventSelection {
  lane: Lane;
  index: number;
}

/** A validation error, worded for the editor and tied to the phrase (and event) it is about */
export interface Problem {
  /** Phrase index, or null for a song field */
  phrase: number | null;
  event: EventSelection | null;
  text: string;
}

/** Grid steps the toolbar offers (beats) */
export const SNAP_STEPS = [0.5, 0.25] as const;
export type SnapStep = (typeof SNAP_STEPS)[number];

/** How many past drafts undo keeps (provisional) */
const UNDO_LIMIT = 100;

export class ChartEditor {
  private current: ChartDraft;
  private past: ChartDraft[] = [];
  private future: ChartDraft[] = [];
  /** The draft as last opened or saved, for "unsaved changes" */
  private saved: ChartDraft;
  /** Id the chart is saved under in the library; null until the first save (or for a copy of a built-in chart) */
  private savedAs: string | null;
  private checked: { draft: ChartDraft; problems: Problem[] } | null = null;
  private selectedPhrase = 0;
  private selectedEvent: EventSelection | null = null;

  constructor(draft: ChartDraft, savedAs: string | null) {
    this.current = draft;
    this.saved = draft;
    this.savedAs = savedAs;
  }

  get draft(): ChartDraft {
    return this.current;
  }

  get phrase(): number {
    return this.selectedPhrase;
  }

  get selection(): EventSelection | null {
    return this.selectedEvent;
  }

  /** The library id this chart replaces when saved; null when saving adds a new chart */
  get savedId(): string | null {
    return this.savedAs;
  }

  get dirty(): boolean {
    return this.current !== this.saved;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Starts over on another chart; undo history is dropped */
  load(draft: ChartDraft, savedAs: string | null): void {
    this.current = draft;
    this.saved = draft;
    this.savedAs = savedAs;
    this.past = [];
    this.future = [];
    this.selectedPhrase = 0;
    this.selectedEvent = null;
  }

  /** The chart was saved to the library under its current id */
  markSaved(): void {
    this.saved = this.current;
    this.savedAs = this.current.id;
  }

  /** Validation errors of the current draft, in the order the checks report them */
  get problems(): Problem[] {
    if (this.checked?.draft !== this.current) {
      const result = checkChartData(draftToSource(this.current));
      this.checked = { draft: this.current, problems: result.errors.map(describeProblem) };
    }
    return this.checked.problems;
  }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.current);
    this.current = previous;
    this.clampSelection();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.current);
    this.current = next;
    this.clampSelection();
  }

  selectPhrase(p: number): void {
    phraseAt(this.current, p);
    if (p !== this.selectedPhrase) this.selectedEvent = null;
    this.selectedPhrase = p;
  }

  selectEvent(selection: EventSelection | null): void {
    this.selectedEvent = selection;
  }

  // ---------- Song ----------

  setSong<F extends SongField>(field: F, value: ChartDraft[F]): void {
    if (this.current[field] === value) return;
    this.apply(setSongField(this.current, field, value));
  }

  setPhraseGap(gap: number | null): void {
    this.apply(setPhraseGap(this.current, this.selectedPhrase, gap));
  }

  // ---------- Phrases ----------

  addPhrase(): void {
    this.apply(addPhrase(this.current, this.selectedPhrase));
    this.selectPhrase(this.selectedPhrase + 1);
  }

  duplicatePhrase(): void {
    this.apply(duplicatePhrase(this.current, this.selectedPhrase));
    this.selectPhrase(this.selectedPhrase + 1);
  }

  deletePhrase(): void {
    this.apply(deletePhrase(this.current, this.selectedPhrase));
    this.selectedEvent = null;
    this.clampSelection();
  }

  movePhrase(by: -1 | 1): void {
    const next = movePhrase(this.current, this.selectedPhrase, by);
    if (next === this.current) return;
    this.apply(next);
    this.selectedPhrase += by;
  }

  // ---------- Events ----------

  /** Puts `action` on call beat `beat` of the selected phrase and selects it */
  place(beat: number, action: ActionType): void {
    const { draft, index } = placeEvent(this.current, this.selectedPhrase, beat, action);
    this.apply(draft);
    this.selectedEvent = { lane: 'call', index };
  }

  /** Moves event `index` in `lane` to `beat` and keeps it selected */
  moveEvent(lane: Lane, index: number, beat: number): void {
    if (lane === 'call') {
      const moved = moveCallEvent(this.current, this.selectedPhrase, index, beat);
      this.apply(moved.draft);
      this.selectedEvent = { lane, index: moved.index };
    } else {
      const event = phraseAt(this.current, this.selectedPhrase).events[index];
      if (!event || event.response === beat) return;
      this.apply(moveResponseEvent(this.current, this.selectedPhrase, index, beat));
      this.selectedEvent = { lane, index };
    }
  }

  /** Removes the selected event (from both lanes, as call and response are one event) */
  removeSelected(): void {
    const selection = this.selectedEvent;
    if (!selection) return;
    this.apply(removeEvent(this.current, this.selectedPhrase, selection.index));
    this.selectedEvent = null;
  }

  resetResponse(): void {
    if (!phraseAt(this.current, this.selectedPhrase).ownResponse) return;
    this.apply(resetResponse(this.current, this.selectedPhrase));
  }

  private apply(next: ChartDraft): void {
    if (next === this.current) return;
    this.past.push(this.current);
    if (this.past.length > UNDO_LIMIT) this.past.shift();
    this.future = [];
    this.current = next;
  }

  /** After undo, redo or a delete: keep the selection inside the chart */
  private clampSelection(): void {
    const phrases = this.current.phrases.length;
    this.selectedPhrase = Math.min(this.selectedPhrase, phrases - 1);
    const events = this.current.phrases[this.selectedPhrase]!.events.length;
    if (this.selectedEvent && this.selectedEvent.index >= events) this.selectedEvent = null;
  }
}

/** Snaps a beat to the grid of `step`, inside the bar */
export function snapBeat(beat: number, step: number, beatsPerBar: number): number {
  const snapped = Math.round(beat / step) * step;
  return Math.min(Math.max(snapped, 0), beatsPerBar - step);
}

/** Every grid point of a bar */
export function gridBeats(beatsPerBar: number, step: number): number[] {
  return Array.from({ length: Math.round(beatsPerBar / step) }, (_, i) => i * step);
}

const SONG_FIELD_NAMES: Record<string, string> = {
  id: 'File name',
  title: 'Title',
  bpm: 'BPM',
  beatsPerBar: 'Beats per bar',
  countInBars: 'Count-in',
  outroBars: 'Outro',
  responseGapBeats: 'Gap',
};

const PHRASE_PATH = /^phrases\[(\d+)\](?:\.(call|response)\[(\d+)\])?(?:\.(\w+))?:?\s*(.*)$/;

/**
 * Rewords a validation error for the editor: field paths become "Phrase 3, call 2: …" and song fields get the names
 * shown in the properties pane.
 */
export function describeProblem(error: string): Problem {
  const match = PHRASE_PATH.exec(error);
  if (!match) {
    const [field, ...rest] = error.split(' ');
    const name = SONG_FIELD_NAMES[field!];
    return { phrase: null, event: null, text: name ? [name, ...rest].join(' ') : error };
  }
  const [, phrase, lane, index, field, rest] = match;
  const p = Number(phrase);
  const event =
    lane === 'call' || lane === 'response' ? { lane: lane as Lane, index: Number(index) } : null;
  const where = event ? `Phrase ${p + 1}, ${event.lane} ${event.index + 1}` : `Phrase ${p + 1}`;
  let what = `${field === undefined ? '' : `${field === 'responseGapBeats' ? 'gap' : field} `}${rest}`;
  if (!event && field === 'call' && rest!.startsWith('must be an array with at least one event')) {
    what = 'add at least one action';
  }
  return { phrase: p, event, text: `${where}: ${what}` };
}
