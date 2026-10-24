// Contents of the latency test window (doc/latency-test.md): instructions, eight beat dots with the press marks,
// a status line and the result. Books every click on the audio clock when started and draws from the heard audio
// time; the window around it supplies the buttons. Group boxes, text and colours come from each scene, like the
// results and settings panels. Top-left at (0, 0).

import { Container, Graphics, type Text } from 'pixi.js';
import { createClickBuffer } from '@/audio/click-sound.ts';
import type { AudioClock } from '@/audio/audio-clock.ts';
import type { PlayerSettings } from '@/game/settings.ts';
import {
  COUNT_IN_CLICKS,
  LatencyTestRun,
  MEASURED_BEATS,
  MIN_PRESSES,
  type TestResult,
} from '@/latency/test-run.ts';
import type { PanelTextStyle } from './results-panel.ts';

/** Beat dot colours, from the scene's theme */
export interface LatencyTestColors {
  well: string;
  wellEdge: string;
  ring: string;
  ringCurrent: string;
  fillCurrent: string;
  fillPressed: string;
  mark: string;
}

export interface LatencyTestKit {
  text(text: string, style: PanelTextStyle): Text;
  groupBox(title: string, width: number, height: number): { view: Container; inner: Container };
  groupInset: { x: number; y: number };
  muted: string;
  textSize: number;
  colors: LatencyTestColors;
}

export type LatencyTestState = 'idle' | 'starting' | 'running' | 'done';

export interface LatencyTestPanelOptions {
  clock: AudioClock;
  settings: PlayerSettings;
  width: number;
  kit: LatencyTestKit;
  /** The state or result changed: the window updates its buttons */
  onChange(): void;
}

/** Delay from pressing Start to the first count-in click (s) */
const START_DELAY = 0.6;
/** The cell's half-width stands for this many ms of offset */
const MARK_RANGE_MS = 150;
const WELL_HEIGHT = 38;
const DOT_RADIUS = 9;
const GAP = 12;
const MEASURE_HEIGHT = 108;
const RESULT_HEIGHT = 84;

const INSTRUCTIONS = `Put on the headphones you play with. After ${COUNT_IN_CLICKS} count-in clicks, press Space or click on each of the next ${MEASURED_BEATS} clicks.`;

export class LatencyTestPanel {
  readonly view = new Container({ label: 'latency-test-panel' });
  readonly height: number;
  private readonly options: LatencyTestPanelOptions;
  private readonly dots = new Graphics();
  private readonly status: Text;
  private readonly suggestionText: Text;
  private readonly detailText: Text;
  private readonly cellWidth: number;
  private readonly output: GainNode;
  private readonly countInClick: AudioBuffer;
  private readonly beatClick: AudioBuffer;
  private sources: AudioBufferSourceNode[] = [];
  private run: LatencyTestRun | null = null;
  private result: TestResult | null = null;
  private _state: LatencyTestState = 'idle';

  constructor(options: LatencyTestPanelOptions) {
    this.options = options;
    const { width, kit } = options;
    const size = kit.textSize;
    const inner = width - kit.groupInset.x;

    const intro = kit.text(INSTRUCTIONS, { size, wrapWidth: width, lineHeight: size + 4 });
    const measureTop = Math.ceil(intro.height) + GAP;

    const measure = kit.groupBox('Measurement', width, MEASURE_HEIGHT);
    measure.view.y = measureTop;
    this.cellWidth = inner / MEASURED_BEATS;
    const well = new Graphics()
      .rect(0, 0, inner, WELL_HEIGHT)
      .fill(kit.colors.wellEdge)
      .rect(1, 1, inner - 2, WELL_HEIGHT - 2)
      .fill(kit.colors.well);
    this.status = kit.text('', { size, color: kit.muted });
    this.status.y = WELL_HEIGHT + 8;
    measure.inner.addChild(well, this.dots, this.status);

    const resultBox = kit.groupBox('Result', width, RESULT_HEIGHT);
    resultBox.view.y = measureTop + MEASURE_HEIGHT + GAP;
    this.suggestionText = kit.text('', { size, bold: true });
    this.detailText = kit.text('', { size: size - 1, color: kit.muted, wrapWidth: inner });
    this.detailText.y = size + 8;
    resultBox.inner.addChild(this.suggestionText, this.detailText);

    this.height = resultBox.view.y + RESULT_HEIGHT;
    this.view.addChild(intro, measure.view, resultBox.view);

    const audio = options.clock.context;
    this.output = audio.createGain();
    this.output.gain.value = 0.9;
    this.output.connect(audio.destination);
    this.countInClick = createClickBuffer(audio, { frequency: 880 });
    this.beatClick = createClickBuffer(audio, { frequency: 1760 });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.render(null);
  }

  get state(): LatencyTestState {
    return this._state;
  }

  /** The suggested calibration of the last finished run (ms), if it had enough presses */
  get suggestionMs(): number | null {
    return this.result?.suggestionMs ?? null;
  }

  /** Start / Measure Again: resumes audio, then books every click of a new run */
  async start(): Promise<void> {
    if (this._state === 'starting' || this._state === 'running') return;
    this.stopClicks();
    this.result = null;
    this.setState('starting');
    await this.options.clock.resume();
    // Back, Esc or leaving the tab may have cancelled while audio resumed
    if (!this.isStarting()) return;
    const audio = this.options.clock.context;
    const run = new LatencyTestRun(audio.currentTime + START_DELAY);
    for (let i = 0; i < COUNT_IN_CLICKS + MEASURED_BEATS; i++) {
      const source = audio.createBufferSource();
      source.buffer = i < COUNT_IN_CLICKS ? this.countInClick : this.beatClick;
      source.connect(this.output);
      source.start(run.clickTime(i));
      this.sources.push(source);
    }
    this.run = run;
    this.setState('running');
  }

  /** A press (Space or a click) at a heard audio time; counts only while running */
  press(audioTime: number): void {
    if (this._state !== 'running' || !this.run) return;
    this.run.press(audioTime);
  }

  /** Call every frame with the heard audio time */
  update(audioTime: number): void {
    if (this._state !== 'running' || !this.run) return;
    if (this.run.phaseAt(audioTime).kind === 'done') {
      this.result = this.run.result();
      this.setState('done');
      this.render(audioTime);
      return;
    }
    this.render(audioTime);
  }

  /** Stops a run in progress (Back, Esc, leaving the tab); a finished result stays */
  cancel(): void {
    if (this._state !== 'starting' && this._state !== 'running') return;
    this.stopClicks();
    this.run = null;
    this.setState('idle');
    this.render(null);
  }

  destroy(): void {
    this.cancel();
    this.stopClicks();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  private readonly onVisibilityChange = () => {
    // Throttled browsers make timing unreliable, so leaving the tab stops the run
    if (document.hidden) this.cancel();
  };

  private isStarting(): boolean {
    return this._state === 'starting';
  }

  private setState(state: LatencyTestState): void {
    this._state = state;
    this.options.onChange();
  }

  private stopClicks(): void {
    for (const source of this.sources) source.stop();
    this.sources = [];
  }

  /** Beat dots, status line and result for the run at `audioTime` (null: no run on) */
  private render(audioTime: number | null): void {
    const { colors } = this.options.kit;
    const run = this.run;
    const phase = run && audioTime !== null ? run.phaseAt(audioTime) : null;
    const current = phase?.kind === 'measuring' ? phase.beat : -1;
    const g = this.dots.clear();
    const cy = WELL_HEIGHT / 2;
    for (let beat = 0; beat < MEASURED_BEATS; beat++) {
      const cx = this.cellWidth * (beat + 0.5);
      const offset = run?.offsetsMs[beat] ?? null;
      const fill =
        offset !== null ? colors.fillPressed : beat === current ? colors.fillCurrent : colors.well;
      g.circle(cx, cy, DOT_RADIUS)
        .fill(fill)
        .stroke({ width: 1, color: beat === current ? colors.ringCurrent : colors.ring });
      if (offset !== null) {
        const shift = Math.max(-1, Math.min(1, offset / MARK_RANGE_MS)) * (this.cellWidth / 2 - 2);
        g.rect(cx + shift - 1, 4, 2, WELL_HEIGHT - 8).fill(colors.mark);
      }
    }

    this.status.text = statusText(this._state, phase);
    const calibration = this.options.settings.values.calibrationMs;
    const result = this.result;
    if (!result) {
      this.suggestionText.text = 'Suggested calibration: —';
      this.detailText.text = `Current calibration: ${formatMs(calibration)}.`;
      return;
    }
    const { presses, meanMs, spreadMs, suggestionMs } = result;
    this.suggestionText.text =
      suggestionMs === null
        ? 'Suggested calibration: —'
        : `Suggested calibration: ${formatMs(suggestionMs)}  (now ${formatMs(calibration)})`;
    const timing =
      meanMs === null || spreadMs === null
        ? 'No presses were heard.'
        : `Average ${Math.round(Math.abs(meanMs))} ms ${meanMs >= 0 ? 'late' : 'early'}, spread ±${Math.round(spreadMs)} ms, ${presses} of ${MEASURED_BEATS} beats pressed.`;
    this.detailText.text =
      suggestionMs === null
        ? `${timing} At least ${MIN_PRESSES} presses are needed; measure again.`
        : timing;
  }
}

function statusText(state: LatencyTestState, phase: ReturnType<LatencyTestRun['phaseAt']> | null) {
  if (state === 'idle') return 'Press Start when you are ready.';
  if (state === 'done') return 'Done. The orange lines show when you pressed.';
  if (!phase || phase.kind === 'waiting') return 'Listen…';
  if (phase.kind === 'count-in') return `Count-in: ${phase.click} of ${COUNT_IN_CLICKS}`;
  if (phase.kind === 'measuring') return `Beat ${phase.beat + 1} of ${MEASURED_BEATS}: press now`;
  return '';
}

/** "+38 ms", "−12 ms", "0 ms" */
export function formatMs(ms: number): string {
  return `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${Math.abs(ms)} ms`;
}
