// Charts: expands a chart file (ChartSource) into the timeline the game uses.
// All times are in beats; beat 0 is the first beat of the song (the start of the count-in).

import type { ActionType } from './actions.ts';
import type { ChartEventSource, ChartSource } from './chart-file.ts';

export interface ChartCue {
  /** Beat position in the song */
  beat: number;
  /** Phrase index (from 0) */
  phrase: number;
  /** Index within the phrase's call / response bar (from 0) */
  index: number;
  action: ActionType;
}

export interface ChartPhrase {
  /** Beat where the call bar starts */
  callStart: number;
  /** Beat where the call bar ends (and the gap starts) */
  callEnd: number;
  /** Beat where the response bar starts (the gap ends) */
  responseStart: number;
  /** Beat where the response bar ends */
  end: number;
}

export interface Chart {
  id: string;
  title: string;
  /** Scene id */
  scene: string;
  bpm: number;
  beatsPerBar: number;
  phrases: ChartPhrase[];
  /** Call events, in time order */
  calls: ChartCue[];
  /** Response targets (what the player presses), in time order */
  responses: ChartCue[];
  /** Beat where the song ends */
  endBeat: number;
}

/** Gap between call and response when a chart sets no responseGapBeats (0.5 at first on 2026-10-24, changed to 0 the same day: the response follows the call directly) */
export const DEFAULT_RESPONSE_GAP_BEATS = 0;

/**
 * Expands a chart: each phrase is a call bar, a gap (responseGapBeats), then a response bar, with no space between phrases.
 * A phrase without response repeats its call. The input must already have passed parseChartFile.
 */
export function buildChart(source: ChartSource): Chart {
  const { beatsPerBar, countInBars, outroBars } = source;
  const defaultGap = source.responseGapBeats ?? DEFAULT_RESPONSE_GAP_BEATS;
  const phrases: ChartPhrase[] = [];
  const calls: ChartCue[] = [];
  const responses: ChartCue[] = [];

  const place = (events: readonly ChartEventSource[], barStart: number, phrase: number) =>
    events.map((event, index) => ({
      beat: barStart + event.beat,
      phrase,
      index,
      action: event.action,
    }));

  let cursor = countInBars * beatsPerBar;
  source.phrases.forEach((phrase, i) => {
    const callStart = cursor;
    const callEnd = callStart + beatsPerBar;
    const responseStart = callEnd + (phrase.responseGapBeats ?? defaultGap);
    const end = responseStart + beatsPerBar;
    phrases.push({ callStart, callEnd, responseStart, end });
    calls.push(...place(phrase.call, callStart, i));
    responses.push(...place(phrase.response ?? phrase.call, responseStart, i));
    cursor = end;
  });

  const endBeat = cursor + outroBars * beatsPerBar;
  return {
    id: source.id,
    title: source.title,
    scene: source.scene,
    bpm: source.bpm,
    beatsPerBar,
    phrases,
    calls,
    responses,
    endBeat,
  };
}
