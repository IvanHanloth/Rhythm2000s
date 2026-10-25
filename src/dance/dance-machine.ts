// The arcade dance machine's 2D screen (doc/dance-machine.md): song list, arrows flying out to a pad ring, results.
// Everything is drawn from the heard audio time each frame; sounds are booked on the audio clock by the sequencer.

import { Container, Graphics, Text } from 'pixi.js';
import type { AudioClock } from '@/audio/audio-clock.ts';
import { Sequencer } from '@/audio/sequencer.ts';
import type { CheatMode } from '@/game/cheat.ts';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import type { SaveSlots } from '@/game/save-slots.ts';
import { beatToTime, secondsPerBeat, timeToBeat } from '@/rhythm/beat.ts';
import { ComboTracker } from '@/rhythm/combo.ts';
import type { Difficulty } from '@/rhythm/difficulty.ts';
import {
  formatScore,
  MAX_SCORE,
  RANK_LABELS,
  summarizeResult,
  type HitResult,
  type ResultSummary,
} from '@/rhythm/result-summary.ts';
import { DANCE_COLORS as C } from '@/theme/dance-machine.ts';
import { BEATS, FONT_FAMILIES, JUDGEMENT_COLORS } from '@/theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '@/ui/easing.ts';
import { createJudgementView } from '@/ui/judgement-view.ts';
import { ARROW_POINTS } from './arrow-shape.ts';
import { buildDanceTrack, type DanceKit } from './backing.ts';
import { listenForPad, type Pad } from './input.ts';
import { StepJudge, type StepJudgement } from './step-judge.ts';
import {
  ARROWS,
  DIRECTION_KEYS,
  DIRECTIONS,
  directionAngle,
  directionOfKeys,
  firstStepBeat,
  LEVEL_RANGE,
  songBeats,
  songSeconds,
  stepNote,
  type Arrow,
  type DanceChart,
  type Direction,
} from './steps.ts';

/** Seconds between pressing Enter and the song's beat 0, so the first sounds are booked in time */
const LEAD_IN = 0.3;
/** Centre of the pad ring */
const CENTER = { x: DESIGN_WIDTH / 2, y: 380 };
/** Distance from the centre to the eight targets */
const RING_RADIUS = 250;
/** Where arrows appear: the edge of the pad picture */
const START_RADIUS = 80;
/** Beats an arrow takes from the pad to its target */
const APPROACH_BEATS = 2;
/** How far past its target a missed arrow flies before it has faded out */
const OVERSHOOT = 140;
/** Half the size of a pad panel in the centre picture */
const PANEL = 17;
/** How long a hit's burst lasts (s) */
const BURST_SECONDS = 0.25;
/** Rows on the song list */
const ROW_HEIGHT = 92;
/** The judgement word and combo sit left of the ring */
const SIDE_X = 210;

/** Rotation that turns the up-pointing arrow shape to point along a direction */
function arrowRotation(direction: Direction): number {
  return directionAngle(direction) + Math.PI / 2;
}

/** A point `radius` from the centre towards a direction */
function ringPoint(direction: Direction, radius: number): { x: number; y: number } {
  const angle = directionAngle(direction);
  return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius };
}

/** Points per grade, as in the results (doc/results.md) */
const POINTS: Record<StepJudgement['level'], number> = { perfect: 1, good: 0.5, miss: 0 };
/** The difficulty dance scores are recorded at: songs play at their own tempo (doc/dance-machine.md "Judging") */
const DANCE_DIFFICULTY: Difficulty = 'normal';
/** Below this mean offset the timing comment calls it on the beat */
const DRIFT_HINT_MS = 20;

const NOTE_COLORS = {
  quarter: C.quarter,
  eighth: C.eighth,
  sixteenth: C.sixteenth,
};

export interface DanceMachineOptions {
  clock: AudioClock;
  kit: DanceKit;
  charts: readonly DanceChart[];
  /** Player calibration (s), subtracted from press times when judging */
  calibration(): number;
  /** The current save holds the best scores */
  saves: SaveSlots;
  /** The cheat code (doc/cheat-code.md): every step Perfect, no score saved */
  cheat: CheatMode;
}

interface StepView {
  view: Graphics;
  direction: Direction;
  /** Song beat of the step */
  beat: number;
}

interface Play {
  chart: DanceChart;
  startTime: number;
  endTime: number;
  sequencer: Sequencer;
  output: GainNode;
  judge: StepJudge;
  steps: StepView[];
  hits: HitResult[];
  combo: ComboTracker;
  /** The cheat was on at some point in the song */
  cheated: boolean;
  view: Container;
  targets: Map<Direction, { target: Graphics; flash: Graphics; burst: Graphics }>;
  /** The lit layer of the pad picture's four panels, shown while their key is held */
  panels: Map<Arrow, Graphics>;
  /** The faint ring and spokes, pulsing on the beat */
  guide: Graphics;
  /** Heard time and grade of each target's last hit */
  burstAt: Map<Direction, { time: number; level: StepJudgement['level'] }>;
  judgement: { view: Container; time: number } | null;
  comboText: Text;
  scoreText: Text;
  progress: Graphics;
}

type State =
  | { kind: 'select'; view: Container; rows: Container[] }
  | ({ kind: 'play' } & Play)
  | { kind: 'results'; view: Container };

export class DanceMachine {
  readonly view = new Container({ label: 'dance-machine' });
  private readonly options: DanceMachineOptions;
  private readonly background = new Graphics();
  private readonly grid = new Graphics();
  private readonly pad: Pad;
  private state: State;
  private selected = 0;

  constructor(options: DanceMachineOptions) {
    this.options = options;
    drawBackground(this.background);
    this.view.addChild(this.background, this.grid);
    this.state = this.openSelect();
    this.pad = listenForPad(options.clock, {
      step: (arrow, time) => this.step(arrow, time),
      confirm: () => this.confirm(),
    });
  }

  update(audioTime: number): void {
    const state = this.state;
    if (state.kind === 'play') {
      this.drawGrid(timeToBeat(state.startTime, state.chart.bpm, audioTime));
      this.updatePlay(state, audioTime);
    } else {
      // An idle 120 BPM pulse on the menus
      this.drawGrid(audioTime * 2);
      if (state.kind === 'select') this.updateSelect(state, audioTime);
    }
  }

  /** Esc: from a song or its results back to the song list (true); on the song list the street takes it (false) */
  onEscape(): boolean {
    if (this.state.kind === 'select') return false;
    this.showSelect();
    return true;
  }

  destroy(): void {
    this.pad.stop();
    if (this.state.kind === 'play') this.stopSong(this.state);
    this.view.destroy({ children: true });
  }

  // ---------- Input ----------

  private step(arrow: Arrow, heardTime: number): void {
    const state = this.state;
    if (state.kind === 'select') {
      const count = this.options.charts.length;
      if (count === 0) return;
      if (arrow === 'up') this.selected = (this.selected - 1 + count) % count;
      if (arrow === 'down') this.selected = (this.selected + 1) % count;
      return;
    }
    if (state.kind !== 'play') return;
    const cheat = this.options.cheat.active;
    if (cheat) state.cheated = true;
    const press = state.judge.press(arrow, heardTime - this.options.calibration(), cheat);
    if (press?.judgement) this.judged(state, press.judgement, heardTime);
  }

  private confirm(): void {
    const state = this.state;
    if (state.kind === 'select') {
      const chart = this.options.charts[this.selected];
      if (chart) this.startSong(chart);
      return;
    }
    if (state.kind === 'results') this.showSelect();
  }

  // ---------- Song list ----------

  private showSelect(): void {
    this.leaveState();
    this.state = this.openSelect();
  }

  private openSelect(): State {
    const view = new Container({ label: 'song-list' });
    const title = text('DANCE MACHINE', 72, C.title, '800');
    title.style.stroke = { color: C.titleEdge, width: 4 };
    title.anchor.set(0.5);
    title.position.set(DESIGN_WIDTH / 2, 92);
    const sub = text('FUNLAND AMUSEMENTS', 24, C.textMuted, '700');
    sub.anchor.set(0.5);
    sub.position.set(DESIGN_WIDTH / 2, 150);
    view.addChild(title, sub);

    const { charts } = this.options;
    const save = this.options.saves.current;
    const rows = charts.map((chart, i) => {
      const row = new Container({ label: `song-${chart.id}` });
      const width = 760;
      const back = new Graphics()
        .roundRect(-width / 2, -ROW_HEIGHT / 2 + 6, width, ROW_HEIGHT - 12, 14)
        .fill(C.rowBack);
      const highlight = new Graphics()
        .roundRect(-width / 2, -ROW_HEIGHT / 2 + 6, width, ROW_HEIGHT - 12, 14)
        .fill(C.selected);
      highlight.label = 'highlight';
      const name = text(chart.title, 34, C.text, '800');
      name.label = 'name';
      name.anchor.set(0, 0.5);
      name.position.set(-width / 2 + 28, -12);
      const seconds = Math.round(songSeconds(chart));
      const detail = text(
        `${chart.bpm} BPM · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        20,
        C.textMuted,
        '700',
      );
      detail.label = 'detail';
      detail.anchor.set(0, 0.5);
      detail.position.set(-width / 2 + 28, 22);
      const feet = new Graphics();
      for (let n = 0; n < LEVEL_RANGE.max; n++) {
        feet.circle(n * 18, 0, 6).fill(n < chart.level ? C.foot : C.footOff);
      }
      feet.position.set(60, -12);
      const best = save?.bestScore(chart.id) ?? null;
      const record = text(
        best === null ? 'NEW' : `BEST ${formatScore(best)}`,
        22,
        C.textMuted,
        '700',
      );
      record.label = 'record';
      record.anchor.set(1, 0.5);
      record.position.set(width / 2 - 28, 22);
      row.addChild(back, highlight, name, detail, feet, record);
      row.position.set(DESIGN_WIDTH / 2, 250 + i * ROW_HEIGHT);
      view.addChild(row);
      return row;
    });

    if (charts.length === 0) {
      const empty = text('No songs installed.', 30, C.text, '700');
      empty.anchor.set(0.5);
      empty.position.set(DESIGN_WIDTH / 2, 330);
      view.addChild(empty);
    }

    const hint = text(
      '↑ ↓ choose · Enter start · Esc leave · Arrow keys or W A S D; two together for a diagonal',
      22,
      C.textMuted,
      '700',
    );
    hint.anchor.set(0.5);
    hint.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT - 48);
    view.addChild(hint);
    this.view.addChild(view);
    return { kind: 'select', view, rows };
  }

  private updateSelect(state: Extract<State, { kind: 'select' }>, audioTime: number): void {
    const pulse = 1 - (audioTime * 2 - Math.floor(audioTime * 2));
    state.rows.forEach((row, i) => {
      const on = i === this.selected;
      row.getChildByLabel('highlight')!.visible = on;
      const color = on ? C.onSelected : C.text;
      const name = row.getChildByLabel('name');
      if (name instanceof Text) name.style.fill = color;
      for (const label of ['detail', 'record']) {
        const line = row.getChildByLabel(label);
        if (line instanceof Text) line.style.fill = on ? C.onSelected : C.textMuted;
      }
      row.scale.set(on ? 1.03 + 0.02 * pulse ** 3 : 1);
    });
  }

  // ---------- Song ----------

  private startSong(chart: DanceChart): void {
    this.leaveState();
    const { clock, kit } = this.options;
    const audio = clock.context;
    const startTime = audio.currentTime + LEAD_IN;
    const output = audio.createGain();
    output.gain.value = 0.8;
    output.connect(audio.destination);
    const sequencer = new Sequencer(audio, output, buildDanceTrack(chart, kit), {
      startTime,
      bpm: chart.bpm,
    });
    sequencer.schedule();
    const first = firstStepBeat(chart);
    const judge = new StepJudge(
      chart.steps.map((step) => ({
        time: beatToTime(startTime, chart.bpm, first + step.beat),
        keys: DIRECTION_KEYS[step.direction],
      })),
    );

    const view = new Container({ label: `song-${chart.id}` });
    const guide = new Graphics();
    guide.position.set(CENTER.x, CENTER.y);
    view.addChild(guide);

    // The pad picture: four arrow panels round a centre plate, as on the real pad
    const pad = new Container({ label: 'pad' });
    pad.position.set(CENTER.x, CENTER.y);
    const base = PANEL * 3.3;
    pad.addChild(
      new Graphics().roundRect(-base, -base, base * 2, base * 2, 10).fill(C.padBase),
      new Graphics().rect(-PANEL, -PANEL, PANEL * 2, PANEL * 2).fill(C.padPlate),
    );
    const panels = new Map<Arrow, Graphics>();
    for (const arrow of ARROWS) {
      const angle = directionAngle(arrow);
      const panel = new Container();
      const litPanel = new Graphics().rect(-PANEL, -PANEL, PANEL * 2, PANEL * 2).fill(C.padLit);
      const mark = new Graphics().poly([...ARROW_POINTS]).fill(C.padArrow);
      mark.scale.set(0.3);
      mark.rotation = arrowRotation(arrow);
      panel.addChild(
        new Graphics().rect(-PANEL, -PANEL, PANEL * 2, PANEL * 2).fill(C.padPanel),
        litPanel,
        mark,
      );
      panel.position.set(Math.cos(angle) * PANEL * 2.2, Math.sin(angle) * PANEL * 2.2);
      pad.addChild(panel);
      panels.set(arrow, litPanel);
    }
    view.addChild(pad);

    const targets = new Map<Direction, { target: Graphics; flash: Graphics; burst: Graphics }>();
    for (const direction of DIRECTIONS) {
      const target = arrowShape(C.targetEdge, null, 0);
      target.stroke({ color: C.target, width: 4 });
      const flash = arrowShape(C.targetFlash, null, 0);
      const burst = new Graphics();
      const at = ringPoint(direction, RING_RADIUS);
      for (const g of [target, flash, burst]) {
        g.position.set(at.x, at.y);
        g.rotation = arrowRotation(direction);
      }
      targets.set(direction, { target, flash, burst });
      view.addChild(target, flash);
    }
    const arrowLayer = new Container({ label: 'arrows' });
    const steps = chart.steps.map((step): StepView => {
      const arrow = arrowShape(NOTE_COLORS[stepNote(step.beat)], C.arrowEdge, 4);
      arrow.rotation = arrowRotation(step.direction);
      arrow.visible = false;
      arrowLayer.addChild(arrow);
      return { view: arrow, direction: step.direction, beat: first + step.beat };
    });
    view.addChild(arrowLayer);
    for (const { burst } of targets.values()) view.addChild(burst);

    const title = text(chart.title, 26, C.text, '800');
    title.position.set(36, 28);
    const scoreText = text(formatScore(0), 40, C.text, '800');
    scoreText.anchor.set(1, 0);
    scoreText.position.set(DESIGN_WIDTH - 36, 24);
    const comboText = text('', 54, C.combo, '800');
    comboText.style.stroke = { color: C.comboEdge, width: 5 };
    comboText.anchor.set(0.5);
    comboText.position.set(SIDE_X, CENTER.y + 70);
    const progress = new Graphics();
    view.addChild(title, scoreText, comboText, progress);
    this.view.addChild(view);

    this.state = {
      kind: 'play',
      chart,
      startTime,
      endTime: beatToTime(startTime, chart.bpm, songBeats(chart)),
      sequencer,
      output,
      judge,
      steps,
      hits: [],
      combo: new ComboTracker(),
      cheated: this.options.cheat.active,
      view,
      targets,
      panels,
      guide,
      burstAt: new Map(),
      judgement: null,
      comboText,
      scoreText,
      progress,
    };
  }

  private updatePlay(play: Play, audioTime: number): void {
    play.sequencer.schedule();
    const cheat = this.options.cheat.active;
    if (cheat) play.cheated = true;
    for (const judgement of play.judge.expire(audioTime - this.options.calibration(), cheat)) {
      this.judged(play, judgement, judgement.time + this.options.calibration());
    }

    const { chart } = play;
    const beat = timeToBeat(play.startTime, chart.bpm, audioTime);
    const beatPulse = beat >= 0 ? (1 - (beat - Math.floor(beat))) ** 3 : 0;

    // The ring and its spokes show where arrows travel, brighter on each beat
    play.guide.clear().circle(0, 0, RING_RADIUS);
    for (const direction of DIRECTIONS) {
      const angle = directionAngle(direction);
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      play.guide
        .moveTo(cos * START_RADIUS, sin * START_RADIUS)
        .lineTo(cos * (RING_RADIUS - 48), sin * (RING_RADIUS - 48));
    }
    play.guide.stroke({ color: C.guide, width: 2, alpha: 0.25 + 0.35 * beatPulse });

    const held = this.pad.held;
    for (const [arrow, litPanel] of play.panels) litPanel.visible = held.has(arrow);
    const lit = directionOfKeys(held);
    for (const [direction, { target, flash, burst }] of play.targets) {
      target.scale.set(1 + 0.06 * beatPulse);
      flash.alpha = direction === lit ? 0.75 : 0;
      burst.clear();
      const hit = play.burstAt.get(direction);
      if (!hit) continue;
      const k = clamp01((audioTime - hit.time) / BURST_SECONDS);
      if (k >= 1) continue;
      const color = hit.level === 'perfect' ? C.burstPerfect : C.burstGood;
      burst
        .circle(0, 0, 40 + 34 * easeOutCubic(k))
        .stroke({ color, width: 10 * (1 - k), alpha: 1 - k });
    }

    const speed = (RING_RADIUS - START_RADIUS) / APPROACH_BEATS;
    play.steps.forEach((step, i) => {
      const radius = RING_RADIUS - (step.beat - beat) * speed;
      const result = play.judge.result(i);
      const hit = result !== null && result.level !== 'miss';
      step.view.visible = !hit && radius >= START_RADIUS && radius < RING_RADIUS + OVERSHOOT;
      if (!step.view.visible) return;
      const at = ringPoint(step.direction, radius);
      step.view.position.set(at.x, at.y);
      // Small at the pad, full size at the target
      const grown = clamp01((radius - START_RADIUS) / (RING_RADIUS - START_RADIUS));
      step.view.scale.set(0.35 + 0.65 * grown);
      const past = clamp01((radius - RING_RADIUS) / OVERSHOOT);
      const halfDown = DIRECTION_KEYS[step.direction].some((key) => play.judge.isPressed(i, key));
      if (result?.level === 'miss') step.view.alpha = 0.35 * (1 - past);
      else step.view.alpha = halfDown ? 0.55 : 1 - past;
    });

    if (play.judgement) {
      const k =
        (audioTime - play.judgement.time) / (BEATS.judgementHold * secondsPerBeat(chart.bpm));
      play.judgement.view.visible = k < 1;
      play.judgement.view.scale.set(0.6 + 0.4 * easeOutBack(clamp01(k * 4)));
      play.judgement.view.alpha = 1 - clamp01((k - 0.7) / 0.3);
    }
    play.comboText.text = play.combo.count >= 2 ? `${play.combo.count} COMBO` : '';
    const lastHit = play.combo.lastHit;
    play.comboText.scale.set(
      lastHit === null ? 1 : 1 + 0.15 * (1 - clamp01((audioTime - lastHit) * 8)),
    );
    // The running score counts every step of the song, so it ends on the result's score
    const points = play.hits.reduce((sum, hit) => sum + POINTS[hit.level], 0);
    play.scoreText.text = formatScore((points / chart.steps.length) * MAX_SCORE);

    const done = clamp01((audioTime - play.startTime) / (play.endTime - play.startTime));
    play.progress
      .clear()
      .rect(36, DESIGN_HEIGHT - 20, DESIGN_WIDTH - 72, 6)
      .fill({ color: C.footOff })
      .rect(36, DESIGN_HEIGHT - 20, (DESIGN_WIDTH - 72) * done, 6)
      .fill({ color: C.selected });

    if (audioTime >= play.endTime && play.judge.allJudged) this.finish(play);
  }

  /** A step was judged at heard time `heardTime` */
  private judged(play: Play, judgement: StepJudgement, heardTime: number): void {
    const step = play.chart.steps[judgement.step]!;
    play.hits.push({
      level: judgement.level,
      offset: judgement.offset,
      phrase: Math.floor(step.beat / play.chart.beatsPerBar),
    });
    play.combo.record(judgement.level, heardTime);
    if (judgement.level !== 'miss') {
      play.burstAt.set(step.direction, { time: heardTime, level: judgement.level });
    }
    play.judgement?.view.destroy({ children: true });
    const view = createJudgementView(judgement.level);
    view.position.set(SIDE_X, CENTER.y - 20);
    play.view.addChild(view);
    play.judgement = { view, time: heardTime };
  }

  private stopSong(play: Play): void {
    play.sequencer.stop();
    play.output.disconnect();
  }

  // ---------- Results ----------

  private finish(play: Play): void {
    const summary = summarizeResult(play.hits);
    const save = this.options.saves.current;
    // Dance songs always play at their own tempo, whatever the save's difficulty, so they count as Normal (×1.0)
    const newBest =
      !play.cheated &&
      save !== null &&
      save.recordScore(play.chart.id, {
        score: summary.score,
        assisted: false,
        difficulty: DANCE_DIFFICULTY,
      });
    this.leaveState();
    this.state = { kind: 'results', view: this.openResults(play, summary, newBest) };
  }

  private openResults(play: Play, summary: ResultSummary, newBest: boolean): Container {
    const view = new Container({ label: 'dance-results' });
    const lines: [string, number, string, number][] = [
      [play.chart.title, 40, C.text, 90],
      [RANK_LABELS[summary.rank].toUpperCase(), 84, C.title, 180],
      [formatScore(summary.score), 64, C.text, 270],
      [
        `Perfect ${summary.counts.perfect}   Good ${summary.counts.good}   Miss ${summary.counts.miss}`,
        30,
        C.text,
        350,
      ],
      [`Max combo ${summary.bestCombo}`, 30, C.textMuted, 396],
    ];
    for (const [value, size, color, y] of lines) {
      const line = text(value, size, color, '800');
      line.anchor.set(0.5);
      line.position.set(DESIGN_WIDTH / 2, y);
      view.addChild(line);
    }
    const title = view.children[1];
    if (title instanceof Text) title.style.stroke = { color: C.titleEdge, width: 4 };

    const tags: [string, string][] = [];
    if (summary.fullCombo) tags.push(['FULL COMBO', JUDGEMENT_COLORS.perfect]);
    if (play.cheated) tags.push(['CHEAT · NOT SAVED', C.textMuted]);
    else if (newBest) tags.push(['NEW RECORD', C.selected]);
    tags.forEach(([value, color], i) => {
      const tag = text(value, 32, color, '800');
      tag.anchor.set(0.5);
      tag.position.set(DESIGN_WIDTH / 2, 470 + i * 46);
      view.addChild(tag);
    });
    const comment = text(timingComment(summary.meanOffsetMs), 22, C.textMuted, '700');
    comment.anchor.set(0.5);
    comment.position.set(DESIGN_WIDTH / 2, 590);
    const hint = text('Enter: song list', 22, C.textMuted, '700');
    hint.anchor.set(0.5);
    hint.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT - 48);
    view.addChild(comment, hint);
    this.view.addChild(view);
    return view;
  }

  // ---------- Shared ----------

  private leaveState(): void {
    const state = this.state;
    if (state.kind === 'play') this.stopSong(state);
    state.view.destroy({ children: true });
  }

  /** The neon floor: lines rushing towards the player once per beat, brighter on the beat */
  private drawGrid(beat: number): void {
    const g = this.grid.clear();
    const pulse = beat >= 0 ? (1 - (beat - Math.floor(beat))) ** 2 : 0;
    const horizon = DESIGN_HEIGHT * 0.55;
    const color = pulse > 0.5 ? C.gridPulse : C.grid;
    const alpha = 0.18 + 0.3 * pulse;
    for (let i = -8; i <= 8; i++) {
      g.moveTo(DESIGN_WIDTH / 2 + i * 40, horizon).lineTo(
        DESIGN_WIDTH / 2 + i * 220,
        DESIGN_HEIGHT,
      );
    }
    const phase = beat - Math.floor(beat);
    for (let i = 0; i < 6; i++) {
      const k = (i + phase) / 6;
      g.moveTo(0, horizon + (DESIGN_HEIGHT - horizon) * k ** 2).lineTo(
        DESIGN_WIDTH,
        horizon + (DESIGN_HEIGHT - horizon) * k ** 2,
      );
    }
    g.stroke({ color, width: 2, alpha });
  }
}

/** One line on the results about early or late steps */
function timingComment(meanOffsetMs: number | null): string {
  if (meanOffsetMs === null)
    return 'No steps hit. Step as each arrow reaches its target on the ring.';
  const ms = Math.round(Math.abs(meanOffsetMs));
  if (ms < DRIFT_HINT_MS) return 'Your steps were right on the beat.';
  return `You stepped ${ms} ms ${meanOffsetMs > 0 ? 'late' : 'early'} on average. Try recalibrating.`;
}

function text(value: string, fontSize: number, fill: string, fontWeight: '700' | '800'): Text {
  return new Text({
    text: value,
    style: { fontFamily: FONT_FAMILIES.display, fontSize, fontWeight, fill },
  });
}

/** An up-pointing block arrow; rotate it for the other directions */
function arrowShape(fill: string, edge: string | null, edgeWidth: number): Graphics {
  const g = new Graphics().poly([...ARROW_POINTS]).fill(fill);
  if (edge !== null && edgeWidth > 0) g.stroke({ color: edge, width: edgeWidth, join: 'round' });
  return g;
}

/** A vertical gradient in bands (no shader needed) */
function drawBackground(g: Graphics): void {
  const bands = 24;
  const top = hex(C.backTop);
  const bottom = hex(C.backBottom);
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const color = top.map((c, j) => Math.round(c + (bottom[j]! - c) * k));
    g.rect(0, (DESIGN_HEIGHT / bands) * i, DESIGN_WIDTH, DESIGN_HEIGHT / bands + 1).fill(
      (color[0]! << 16) | (color[1]! << 8) | color[2]!,
    );
  }
}

function hex(color: string): number[] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
