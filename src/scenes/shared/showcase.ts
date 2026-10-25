// The showcase computers' tour (doc/showcase.md): every widget of a scene, then the hit effects, the rhythm widgets
// and the combo effects, one at a time on one beat grid, looping. This lays the tour out in beats and builds the
// backing drums for the parts without a widget; LevelScene runs it. No PixiJS, so unit tests can use it.

import type { SequencedSound } from '@/audio/sequencer.ts';
import type { ActionType } from '@/rhythm/actions.ts';
import { buildChart, type Chart } from '@/rhythm/chart.ts';
import { CHART_FORMAT_VERSION } from '@/rhythm/chart-file.ts';
import type { EffectTier } from '@/rhythm/combo.ts';
import type { JudgementLevel } from '@/rhythm/judge.ts';
import type { SceneId } from '@/scenes/catalog.ts';
import { drumBars, type DrumKit } from './backing-track.ts';

/** Tempo and metre of the whole tour (doc/showcase.md "Provisional") */
export const SHOWCASE_BPM = 120;
export const SHOWCASE_BEATS_PER_BAR = 4;

/** Bars of each part (doc/showcase.md "Provisional") */
const BARS = {
  countIn: 1,
  judgement: 1,
  beatGuide: 3,
  turnBanner: 2,
  tier: { 1: 2, 2: 2, 3: 4 } satisfies Record<EffectTier, number>,
  comboBreak: 1,
};

const JUDGEMENTS: readonly JudgementLevel[] = ['perfect', 'good', 'miss'];

/** One item of the tour; `start` and `end` are beats from the start of a pass */
export type ShowcaseAct = { start: number; end: number } & (
  | { kind: 'widget'; action: ActionType; chart: Chart }
  | { kind: 'judgement'; level: JudgementLevel }
  | { kind: 'beat-guide'; chart: Chart }
  | { kind: 'turn-banner'; chart: Chart }
  | { kind: 'combo'; tier: EffectTier }
  | { kind: 'combo-break' }
);

export interface Showcase {
  acts: ShowcaseAct[];
  /** Beats in one pass, count-in included; the next pass starts here */
  passBeats: number;
}

/** A one-phrase chart with `action` on the call bar's first beat, like a demo (doc/level-design.md "Rule 1") */
function phraseChart(
  sceneId: SceneId,
  action: ActionType,
  countInBars: number,
  name: string,
): Chart {
  return buildChart({
    format: CHART_FORMAT_VERSION,
    id: `showcase--${name}`,
    title: 'Showcase',
    scene: sceneId,
    bpm: SHOWCASE_BPM,
    beatsPerBar: SHOWCASE_BEATS_PER_BAR,
    countInBars,
    outroBars: 0,
    responseGapBeats: 0,
    phrases: [{ call: [{ beat: 0, action }] }],
  });
}

/** The tour of a scene with these actions (the scene catalog's, in its order) */
export function buildShowcase(sceneId: SceneId, actions: readonly ActionType[]): Showcase {
  const first = actions[0];
  if (first === undefined) throw new Error(`Scene ${sceneId} has no actions to show`);
  const bar = SHOWCASE_BEATS_PER_BAR;
  const acts: ShowcaseAct[] = [];
  let cursor = BARS.countIn * bar;
  /** The next `bars` bars of the tour */
  const span = (bars: number) => {
    const start = cursor;
    cursor += bars * bar;
    return { start, end: cursor };
  };

  for (const action of actions) {
    const chart = phraseChart(sceneId, action, 0, action);
    acts.push({ ...span(chart.endBeat / bar), kind: 'widget', action, chart });
  }
  for (const level of JUDGEMENTS) acts.push({ ...span(BARS.judgement), kind: 'judgement', level });
  acts.push({
    ...span(BARS.beatGuide),
    kind: 'beat-guide',
    chart: phraseChart(sceneId, first, 1, 'beat-guide'),
  });
  acts.push({
    ...span(BARS.turnBanner),
    kind: 'turn-banner',
    chart: phraseChart(sceneId, first, 0, 'turn-banner'),
  });
  for (const tier of [1, 2, 3] as const)
    acts.push({ ...span(BARS.tier[tier]), kind: 'combo', tier });
  acts.push({ ...span(BARS.comboBreak), kind: 'combo-break' });
  return { acts, passBeats: cursor };
}

/** The act on at `beat` (from the start of a pass); null in the count-in */
export function showcaseActAt(showcase: Showcase, beat: number): ShowcaseAct | null {
  return showcase.acts.find((act) => beat >= act.start && beat < act.end) ?? null;
}

/**
 * Drums for one pass: the count-in metronome, then the shared drum pattern under every part without a widget.
 * Widgets play their own round's backing track.
 */
export function showcaseDrums(showcase: Showcase, kit: DrumKit): SequencedSound[] {
  const track: SequencedSound[] = [];
  const countIn = showcase.acts[0]?.start ?? showcase.passBeats;
  for (let beat = 0; beat < countIn; beat++) {
    track.push({ beat, buffer: beat % SHOWCASE_BEATS_PER_BAR === 0 ? kit.countAccent : kit.count });
  }
  for (const act of showcase.acts) {
    if (act.kind !== 'widget') drumBars(track, kit, act.start, act.end);
  }
  return track;
}
