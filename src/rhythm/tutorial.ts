// The system demo (doc/level-design.md "Rule 1"): before the chart, each action it uses is demonstrated
// in turn and must be played back without a Miss before the next; demos are not scored.
// This picks the actions, builds each demo chart, judges a pass and holds the hint texts; scenes run the flow.

import type { ActionType } from './actions.ts';
import { buildChart, type Chart } from './chart.ts';
import type { JudgementLevel } from './judge.ts';

/** Actions the chart uses, in order of first appearance */
export function tutorialActions(chart: Chart): ActionType[] {
  const cues = [...chart.calls, ...chart.responses].sort((a, b) => a.beat - b.beat);
  return [...new Set(cues.map((cue) => cue.action))];
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
