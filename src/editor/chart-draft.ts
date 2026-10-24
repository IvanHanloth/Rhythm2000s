// The chart HackerEditor works on (doc/chart-editor.md): the chart file's fields, with each phrase's events kept as
// pairs so the response always has the call's actions in the call's order. Every edit returns a new draft, which
// makes undo a list of drafts. No PixiJS, so unit tests can use it.

import type { ActionType } from '@/rhythm/actions.ts';
import { DEFAULT_RESPONSE_GAP_BEATS } from '@/rhythm/chart.ts';
import {
  CHART_FORMAT_VERSION,
  type ChartEventSource,
  type ChartPhraseSource,
  type ChartSource,
} from '@/rhythm/chart-file.ts';
import type { SceneId } from '@/scenes/catalog.ts';

/** One action of a phrase: its beat in the call bar and in the response bar (from the start of each bar) */
export interface DraftEvent {
  action: ActionType;
  call: number;
  response: number;
}

export interface DraftPhrase {
  /** In call order */
  events: DraftEvent[];
  /** The response has a rhythm of its own; otherwise every response beat equals its call beat */
  ownResponse: boolean;
  /** This phrase's gap (beats); null uses the song's */
  gap: number | null;
}

export interface ChartDraft {
  /** Chart id, also the file name; empty until the player names it */
  id: string;
  title: string;
  /** The level icon (an icon ID of the scene); null leaves it to the actions */
  icon: string | null;
  scene: SceneId;
  bpm: number;
  beatsPerBar: number;
  countInBars: number;
  outroBars: number;
  /** The song's gap between call and response (beats) */
  gap: number;
  phrases: DraftPhrase[];
}

/** Song fields set in the properties pane */
export type SongField =
  | 'title'
  | 'id'
  | 'icon'
  | 'bpm'
  | 'beatsPerBar'
  | 'countInBars'
  | 'outroBars'
  | 'gap';

/** A new chart: one empty phrase at 120 BPM in 4/4, with a count-in bar and an outro bar (provisional defaults) */
export function newDraft(scene: SceneId): ChartDraft {
  return {
    id: '',
    title: 'Untitled',
    icon: null,
    scene,
    bpm: 120,
    beatsPerBar: 4,
    countInBars: 1,
    outroBars: 1,
    gap: DEFAULT_RESPONSE_GAP_BEATS,
    phrases: [emptyPhrase()],
  };
}

export function emptyPhrase(): DraftPhrase {
  return { events: [], ownResponse: false, gap: null };
}

/** A validated chart file as a draft. Its scene rules pair every response event with the call event at the same index */
export function draftFromSource(source: ChartSource): ChartDraft {
  return {
    id: source.id,
    title: source.title,
    icon: source.icon ?? null,
    scene: source.scene as SceneId,
    bpm: source.bpm,
    beatsPerBar: source.beatsPerBar,
    countInBars: source.countInBars,
    outroBars: source.outroBars,
    gap: source.responseGapBeats ?? DEFAULT_RESPONSE_GAP_BEATS,
    phrases: source.phrases.map((phrase, p) => {
      const response = phrase.response ?? phrase.call;
      if (response.length !== phrase.call.length) {
        throw new Error(
          `Phrase ${p + 1} has ${phrase.call.length} call and ${response.length} response events`,
        );
      }
      const events = phrase.call.map((event, i) => ({
        action: event.action,
        call: event.beat,
        response: response[i]!.beat,
      }));
      return {
        events,
        ownResponse: events.some((e) => e.response !== e.call),
        gap: phrase.responseGapBeats ?? null,
      };
    }),
  };
}

/**
 * The chart file for a draft. `response` is written only when its rhythm differs from the call, and gaps only when
 * they differ from the default, so the file stays as short as a hand-written one.
 */
export function draftToSource(draft: ChartDraft): ChartSource {
  return {
    format: CHART_FORMAT_VERSION,
    id: draft.id,
    title: draft.title,
    ...(draft.icon !== null && { icon: draft.icon }),
    scene: draft.scene,
    bpm: draft.bpm,
    beatsPerBar: draft.beatsPerBar,
    countInBars: draft.countInBars,
    outroBars: draft.outroBars,
    ...(draft.gap !== DEFAULT_RESPONSE_GAP_BEATS && { responseGapBeats: draft.gap }),
    phrases: draft.phrases.map((phrase): ChartPhraseSource => {
      const call = phrase.events.map((e): ChartEventSource => ({ beat: e.call, action: e.action }));
      const differs = phrase.events.some((e) => e.response !== e.call);
      return {
        call,
        ...(differs && {
          response: phrase.events.map((e) => ({ beat: e.response, action: e.action })),
        }),
        ...(phrase.gap !== null && { responseGapBeats: phrase.gap }),
      };
    }),
  };
}

// ---------- Song ----------

export function setSongField<F extends SongField>(
  draft: ChartDraft,
  field: F,
  value: ChartDraft[F],
): ChartDraft {
  return { ...draft, [field]: value };
}

// ---------- Phrases ----------

/** A new empty phrase after phrase `after` */
export function addPhrase(draft: ChartDraft, after: number): ChartDraft {
  return withPhrases(draft, (phrases) => phrases.toSpliced(after + 1, 0, emptyPhrase()));
}

/** A copy of phrase `p` right after it */
export function duplicatePhrase(draft: ChartDraft, p: number): ChartDraft {
  const phrase = phraseAt(draft, p);
  const copy = { ...phrase, events: phrase.events.map((e) => ({ ...e })) };
  return withPhrases(draft, (phrases) => phrases.toSpliced(p + 1, 0, copy));
}

/** Deletes phrase `p`; a chart always keeps one phrase, so the last one is emptied instead */
export function deletePhrase(draft: ChartDraft, p: number): ChartDraft {
  phraseAt(draft, p);
  if (draft.phrases.length === 1) return withPhrases(draft, () => [emptyPhrase()]);
  return withPhrases(draft, (phrases) => phrases.toSpliced(p, 1));
}

/** Swaps phrase `p` with its neighbour (`by` −1 earlier, +1 later); does nothing at either end */
export function movePhrase(draft: ChartDraft, p: number, by: -1 | 1): ChartDraft {
  const q = p + by;
  if (q < 0 || q >= draft.phrases.length) return draft;
  return withPhrases(draft, (phrases) => {
    const next = [...phrases];
    [next[p], next[q]] = [next[q]!, next[p]!];
    return next;
  });
}

/** Phrase `p`'s own gap, or null for the song's */
export function setPhraseGap(draft: ChartDraft, p: number, gap: number | null): ChartDraft {
  return updatePhrase(draft, p, (phrase) => ({ ...phrase, gap }));
}

// ---------- Events ----------

/**
 * Puts `action` on call beat `beat`. An event already on that beat takes the new action; otherwise a new event
 * goes in at its place in call order, on the same beat in the response.
 */
export function placeEvent(
  draft: ChartDraft,
  p: number,
  beat: number,
  action: ActionType,
): { draft: ChartDraft; index: number } {
  const phrase = phraseAt(draft, p);
  const existing = phrase.events.findIndex((e) => e.call === beat);
  if (existing >= 0) {
    const events = phrase.events.map((e, i) => (i === existing ? { ...e, action } : e));
    return { draft: updatePhrase(draft, p, () => ({ ...phrase, events })), index: existing };
  }
  const index = insertionIndex(phrase.events, beat);
  const events = phrase.events.toSpliced(index, 0, { action, call: beat, response: beat });
  return { draft: updatePhrase(draft, p, () => ({ ...phrase, events })), index };
}

/**
 * Moves event `i` of phrase `p` to call beat `beat`, keeping call order. A response following the call moves too.
 * Returns the event's new index; an occupied beat leaves the draft as it was.
 */
export function moveCallEvent(
  draft: ChartDraft,
  p: number,
  i: number,
  beat: number,
): { draft: ChartDraft; index: number } {
  const phrase = phraseAt(draft, p);
  const event = eventAt(phrase, i);
  if (phrase.events.some((e, j) => j !== i && e.call === beat)) return { draft, index: i };
  const moved = { ...event, call: beat, response: phrase.ownResponse ? event.response : beat };
  const rest = phrase.events.toSpliced(i, 1);
  const index = insertionIndex(rest, beat);
  const events = rest.toSpliced(index, 0, moved);
  return { draft: updatePhrase(draft, p, () => ({ ...phrase, events })), index };
}

/** Moves event `i`'s response to `beat`; the phrase then has a response rhythm of its own */
export function moveResponseEvent(
  draft: ChartDraft,
  p: number,
  i: number,
  beat: number,
): ChartDraft {
  const phrase = phraseAt(draft, p);
  eventAt(phrase, i);
  const events = phrase.events.map((e, j) => (j === i ? { ...e, response: beat } : e));
  return updatePhrase(draft, p, () => ({ ...phrase, events, ownResponse: true }));
}

export function removeEvent(draft: ChartDraft, p: number, i: number): ChartDraft {
  const phrase = phraseAt(draft, p);
  eventAt(phrase, i);
  return updatePhrase(draft, p, () => ({ ...phrase, events: phrase.events.toSpliced(i, 1) }));
}

/** "Reset to call": the response follows the call again */
export function resetResponse(draft: ChartDraft, p: number): ChartDraft {
  const phrase = phraseAt(draft, p);
  const events = phrase.events.map((e) => ({ ...e, response: e.call }));
  return updatePhrase(draft, p, () => ({ ...phrase, events, ownResponse: false }));
}

// ---------- Helpers ----------

export function phraseAt(draft: ChartDraft, p: number): DraftPhrase {
  const phrase = draft.phrases[p];
  if (!phrase) throw new Error(`No phrase ${p}`);
  return phrase;
}

function eventAt(phrase: DraftPhrase, i: number): DraftEvent {
  const event = phrase.events[i];
  if (!event) throw new Error(`No event ${i} in the phrase`);
  return event;
}

function insertionIndex(events: readonly DraftEvent[], beat: number): number {
  const after = events.findIndex((e) => e.call > beat);
  return after < 0 ? events.length : after;
}

function withPhrases(
  draft: ChartDraft,
  change: (phrases: DraftPhrase[]) => DraftPhrase[],
): ChartDraft {
  return { ...draft, phrases: change(draft.phrases) };
}

function updatePhrase(
  draft: ChartDraft,
  p: number,
  change: (phrase: DraftPhrase) => DraftPhrase,
): ChartDraft {
  const phrase = phraseAt(draft, p);
  return withPhrases(draft, (phrases) => phrases.map((q, j) => (j === p ? change(phrase) : q)));
}
