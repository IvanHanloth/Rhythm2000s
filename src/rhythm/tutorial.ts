// The system demo (doc/level-design.md "Rule 1", ADR 0008): right before the first phrase that uses an action,
// the chart stops and that action is demonstrated, and must be played back without a Miss before the next;
// demos are not scored. This finds the stops, cuts the chart into the pieces between them, builds each demo
// chart, judges a pass and holds the hint texts; scenes run the flow.

import type { ActionType } from './actions.ts';
import { buildChart, type Chart, type ChartCue } from './chart.ts';
import type { JudgementLevel } from './judge.ts';

/** A place where the chart stops for demos: the actions first used in this phrase, in order of appearance */
export interface TutorialStop {
  phrase: number;
  actions: ActionType[];
}

/** One stop per phrase that brings in actions not used in any earlier phrase, in phrase order */
export function tutorialStops(chart: Chart): TutorialStop[] {
  const cues = [...chart.calls, ...chart.responses].sort((a, b) => a.beat - b.beat);
  const seen = new Set<ActionType>();
  const stops: TutorialStop[] = [];
  chart.phrases.forEach((_, phrase) => {
    const actions = cues
      .filter((cue) => cue.phrase === phrase && !seen.has(cue.action))
      .map((cue) => cue.action);
    const fresh = [...new Set(actions)];
    if (fresh.length === 0) return;
    for (const action of fresh) seen.add(action);
    stops.push({ phrase, actions: fresh });
  });
  return stops;
}

/**
 * The phrases [first, end) of a chart as a chart of their own, played after a demo: the first piece keeps the
 * chart's count-in, later ones get one count-in bar; only the piece that reaches the end keeps the outro.
 * Phrase indices restart from 0, so add `first` to get back to the chart's phrase numbers.
 */
export function chartSegment(chart: Chart, first: number, end: number): Chart {
  const firstPhrase = chart.phrases[first];
  const lastPhrase = chart.phrases[end - 1];
  if (!firstPhrase || !lastPhrase || end <= first) {
    throw new Error(`Chart ${chart.id} has no phrases ${first}..${end - 1}`);
  }
  const countIn = first === 0 ? firstPhrase.callStart : chart.beatsPerBar;
  const shift = countIn - firstPhrase.callStart;
  const outro = end === chart.phrases.length ? chart.endBeat - lastPhrase.end : 0;
  const take = (cues: readonly ChartCue[]) =>
    cues
      .filter((cue) => cue.phrase >= first && cue.phrase < end)
      .map((cue) => ({ ...cue, beat: cue.beat + shift, phrase: cue.phrase - first }));
  return {
    ...chart,
    id:
      first === 0 && end === chart.phrases.length
        ? chart.id
        : `${chart.id}--phrases-${first}-${end}`,
    phrases: chart.phrases.slice(first, end).map((phrase) => ({
      callStart: phrase.callStart + shift,
      callEnd: phrase.callEnd + shift,
      responseStart: phrase.responseStart + shift,
      end: phrase.end + shift,
    })),
    calls: take(chart.calls),
    responses: take(chart.responses),
    endBeat: lastPhrase.end + shift + outro,
  };
}

/**
 * The demo chart for one action: the chart's tempo and metre, one count-in bar, then one phrase
 * (call and response) with the action on its first beat, and no outro.
 */
export function buildTutorialChart(chart: Chart, action: ActionType): Chart {
  return buildChart({
    format: 1,
    id: `${chart.id}--tutorial--${action}`,
    title: chart.title,
    scene: chart.scene,
    bpm: chart.bpm,
    beatsPerBar: chart.beatsPerBar,
    countInBars: 1,
    outroBars: 0,
    responseGapBeats: 0,
    phrases: [{ call: [{ beat: 0, action }] }],
  });
}

/** A demo round passes when every press was judged and none missed */
export function tutorialPassed(levels: readonly JudgementLevel[], targets: number): boolean {
  return levels.length >= targets && levels.every((level) => level !== 'miss');
}

/** Text on the demo caption */
export interface TutorialHint {
  name: string;
  /** How to handle it */
  how: string;
}

const HINTS: Record<ActionType, TutorialHint> = {
  'dialog-info': { name: 'Information box', how: 'Close it on the beat' },
  'dialog-warning': { name: 'Warning box', how: 'Close it on the beat' },
  'dialog-error': { name: 'Error box', how: 'Close it on the beat' },
  'dialog-question': { name: 'Question box', how: 'Close it on the beat' },
  'desktop-refresh': { name: 'Refresh', how: 'Right-click, then Refresh half a beat later' },
  'balloon-info': { name: 'Balloon tip', how: 'Close it on the beat' },
  'window-minimize': { name: 'Program window', how: 'Minimize it on the beat' },
  'start-menu': { name: 'Start menu', how: 'Start, then a program half a beat later' },
  'recycle-bin': { name: 'Recycle Bin', how: 'Throw the file away on the beat' },
  'progress-download': { name: 'File download', how: 'Wait for the bar, click Open as it fills' },
  'volume-mute': { name: 'Volume', how: 'Grab the slider on the beat' },
  'alert-note': { name: 'Alert', how: 'Click OK on the beat' },
  'alert-caution': { name: 'Caution alert', how: 'Click OK on the beat' },
  'alert-stop': { name: 'Stop alert', how: 'Click OK on the beat' },
  'dock-bounce': { name: 'Bouncing icon', how: 'Click it on the beat' },
  'mail-new': { name: 'New mail', how: 'Read it on the beat' },
  'window-miniaturize': { name: 'Window', how: 'Minimize it to the Dock on the beat' },
  'menu-apple': { name: 'Apple menu', how: 'Click the Apple, then an item half a beat later' },
  'dock-trash': { name: 'Trash', how: 'Drag the file to the Trash on the beat' },
  'sheet-save': { name: 'Save sheet', how: "Close the window, then Don't Save half a beat later" },
  'ichat-message': { name: 'iChat message', how: 'Click it on the beat' },
  'menu-volume': { name: 'Volume', how: 'Grab the slider on the beat' },
};

export function tutorialHint(action: ActionType): TutorialHint {
  return HINTS[action];
}
