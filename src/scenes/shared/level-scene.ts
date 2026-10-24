// The level flow every desktop scene shares: pick a level on the in-game desktop (doc/level-select.md),
// show the shell's level intro, then play the chart in pieces: before the first phrase that uses an action the
// chart stops for its demo, one small round per new action, each repeated until passed (doc/level-design.md
// "Rule 1", ADR 0008); Tab skips every remaining demo. The results count all pieces together (doc/results.md).
// Subclasses draw the desktop and its widgets; everything is computed from audio time, never from frame deltas.
//
// States: select (choosing in the level list); ready (the shell shows the intro and waits for the first press);
// starting (waiting for audio to resume); playing (a round is running); result (the results window is up).
// Outside `playing` and `ready`, clicks and Space are not rhythm input; only buttons, icons and keys respond.

import { Container, Rectangle } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { recordScore } from '@/game/records.ts';
import type { FrameInfo, Scene, SceneContext, TapInfo } from '@/game/scene.ts';
import { loadSkipTutorial } from '@/game/settings.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { summarizeResult, type HitResult, type ResultSummary } from '@/rhythm/result-summary.ts';
import { buildTurnCues, turnCueAt, type TurnCue } from '@/rhythm/turn-cue.ts';
import {
  buildTutorialChart,
  chartSegment,
  tutorialHint,
  tutorialPassed,
  tutorialStops,
  type TutorialStop,
} from '@/rhythm/tutorial.ts';
import { BEATS, type ThemeColors } from '@/theme/tokens.ts';
import { BEAT_GUIDE_POSITION, BeatGuideView } from '@/ui/beat-guide-view.ts';
import { clamp01 } from '@/ui/easing.ts';
import { TurnBanner } from '@/ui/turn-banner.ts';
import { TutorialCaption } from '@/ui/tutorial-caption.ts';
import type { SceneId } from '@/scenes/catalog.ts';
import type { RoundSession } from './round-session.ts';

/** How long after the results appear before Retry / Next accept input (ms), against mashing through */
const RESULT_INPUT_DELAY_MS = 600;
/** Left edge of the demo caption: just right of the 240-wide turn banner (canvas coordinates) */
const CAPTION_X = DESIGN_WIDTH / 2 + 136;

const LIST_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type State = 'select' | 'ready' | 'starting' | 'playing' | 'result';

/** A level in progress: the demo stops still ahead, the round that is on, and the chart's judgements so far */
interface LevelRun {
  /** Stops not finished yet; the first is the one being demonstrated. Emptied when the tutorial is skipped */
  stops: TutorialStop[];
  /** Index into stops[0].actions of the demo round on, or null while a piece of the chart plays */
  demo: number | null;
  /** The demo round on repeats a failed one */
  retry: boolean;
  /** Demos passed, and how many the level has (for the caption) */
  passed: number;
  total: number;
  /** First chart phrase of the piece playing */
  pieceStart: number;
  /** First chart phrase not played yet */
  nextPhrase: number;
  /** Judgements of the pieces played, with the chart's phrase numbers */
  hits: HitResult[];
  /** The beat guide was on at some point during the chart */
  assisted: boolean;
}

/** The scene's level list (Explorer / Finder window) */
export interface LevelList {
  readonly view: Container;
  readonly selectedIndex: number;
  select(index: number): void;
  move(dx: number, dy: number): void;
  setActive(active: boolean): void;
}

/** What a scene's results window is given */
export interface ResultsWindowOptions {
  title: string;
  summary: ResultSummary;
  newRecord: boolean;
  /** The beat guide was on during the chart (doc/beat-guide.md) */
  assisted: boolean;
  /** Another level follows in the list; without one "Next Level" is disabled and Retry is the default */
  hasNext: boolean;
  onRetry: () => void;
  onList: () => void;
  onNext: () => void;
}

/** A modal window on the desktop: a message box, an alert or the results window */
export interface ModalWindow {
  destroy(): void;
  /** Called every frame, for windows that animate (Aqua's pulsing default button) */
  update?(audioTime: number): void;
}

export interface LevelSceneOptions {
  id: SceneId;
  theme: ThemeColors;
  /** Vertical centre of the turn banner and demo caption (canvas coordinates) */
  bannerY: number;
}

export abstract class LevelScene<S extends RoundSession> implements Scene {
  readonly view: Container;
  protected readonly context: SceneContext;
  /** Every chart on this computer */
  protected readonly charts: Chart[];
  /** The scene's desktop, drawn in its own virtual screen coordinates; subclasses set its scale */
  protected readonly screen = new Container({ label: 'screen' });
  /** Judgement labels, in canvas coordinates */
  protected readonly judgementLayer = new Container({ label: 'judgements' });
  protected session: S | null = null;
  protected abstract readonly levelList: LevelList;

  private readonly turnBanner: TurnBanner;
  private readonly caption: TutorialCaption;
  /** The beat guide ((((O))), toggled with H) */
  private readonly beatGuide = new BeatGuideView();
  /** Covers the canvas during a round, hiding the player's own cursor so it is not confused with the virtual mouse */
  private readonly cursorCover = new Container({ label: 'cursor-cover' });
  /** Scene sounds outside a round (clicks, the results jingle); a round plays through its session */
  private readonly output: GainNode;
  private state: State = 'select';
  /** The chosen level's chart (the session plays a demo chart or a piece of this one) */
  private chart: Chart | null = null;
  private run: LevelRun | null = null;
  private turnCues: TurnCue[] = [];
  private modal: ModalWindow | null = null;
  /** What Enter / Space does on the results window */
  private resultDefault: () => void = () => {};
  private resultShownAt = 0;
  private destroyed = false;

  constructor(context: SceneContext, options: LevelSceneOptions) {
    this.context = context;
    this.view = new Container({ label: options.id });
    this.charts = context.charts.filter((chart) => chart.scene === options.id);
    const { theme, bannerY } = options;
    // Call: raised face like a button; response: the accent colour
    this.turnBanner = new TurnBanner({
      call: { fill: theme.surfaceRaised, text: theme.ink, line: theme.line },
      response: { fill: theme.accent, text: theme.onAccent, line: theme.highlight },
    });
    this.caption = new TutorialCaption({
      fill: theme.surfaceRaised,
      text: theme.ink,
      line: theme.line,
    });
    const audio = context.clock.context;
    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.turnBanner.view.position.set(DESIGN_WIDTH / 2, bannerY);
    this.caption.view.position.set(CAPTION_X, bannerY);
    this.beatGuide.view.position.set(BEAT_GUIDE_POSITION.x, BEAT_GUIDE_POSITION.y);
    this.cursorCover.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.cursorCover.cursor = 'none';
    this.cursorCover.eventMode = 'none';
    // The beat guide sits above the desktop, below the judgements and banners
    this.view.addChild(
      this.screen,
      this.beatGuide.view,
      this.judgementLayer,
      this.turnBanner.view,
      this.caption.view,
      this.cursorCover,
    );
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Session for one round: the chart itself or a demo chart */
  protected abstract createSession(chart: Chart): S;
  /** Builds the round's widgets and the virtual mouse */
  protected abstract buildRound(session: S): void;
  /** Tears down what buildRound made */
  protected abstract clearRound(): void;
  /** Draws the round at a beat */
  protected abstract renderRound(session: S, beat: number, audioTime: number): void;
  /** Opens the results window on the desktop */
  protected abstract openResults(options: ResultsWindowOptions): ModalWindow;
  /** Shows or hides the level list window */
  protected abstract setListVisible(visible: boolean): void;
  /** Sound played when a round's results appear */
  protected abstract resultSound(): AudioBuffer;

  /** Desktop decoration that runs regardless of state (clocks, list animations) */
  protected updateDesktop(_audioTime: number): void {}

  /** A level was picked in the list, before its intro */
  protected onLevelOpened(): void {}

  update({ audioTime }: FrameInfo): void {
    this.updateDesktop(audioTime);
    this.modal?.update?.(audioTime);

    const session = this.session;
    if (this.state !== 'playing' || !session) return;
    session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderRound(session, beat, audioTime);
    this.renderTurnBanner(beat);
    this.renderCaption();
    this.renderBeatGuide(beat);

    if (audioTime < session.endTime) return;
    this.roundEnded(session);
  }

  /** Space and clicks are rhythm input only during a round; on the intro the first press starts the level */
  onTap({ audioTime }: TapInfo): void {
    if (this.state === 'playing') this.session?.tap(audioTime);
    else if (this.state === 'ready' && this.chart) void this.start(this.chart);
  }

  /** Esc in a level or on the results goes back to the list; on the list the shell returns to the street */
  onEscape(): boolean {
    if (this.state === 'select') return false;
    this.backToList();
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.endRound();
    this.closeModal();
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  /** Opens the level the URL asked for (#scene/chart), skipping the list. Subclasses call it once built. */
  protected openRequestedLevel(): void {
    const index = this.charts.findIndex((chart) => chart.id === this.context.chartId);
    if (index < 0) return;
    this.levelList.select(index);
    this.ready(this.charts[index]!);
  }

  /** Shows a modal window on the desktop (replacing any other); the level list goes inactive behind it */
  protected showModal(modal: ModalWindow): void {
    this.closeModal();
    this.levelList.setActive(false);
    this.modal = modal;
  }

  protected closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    if (this.state === 'select') this.levelList.setActive(true);
  }

  protected playNow(buffer: AudioBuffer): void {
    const source = this.context.clock.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }

  /** Double-clicking an icon or the list's start button */
  protected openLevel(index: number): void {
    const chart = this.charts[index];
    if (!chart || this.state !== 'select') return;
    this.onLevelOpened();
    this.ready(chart);
  }

  /** List: arrow keys select, Enter starts. Demo: Tab skips the tutorial. Results: Enter / Space press the default button, R retries */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (this.state === 'select' && !this.modal) {
      const move = LIST_MOVES[event.code];
      if (move) {
        event.preventDefault();
        this.levelList.move(...move);
      } else if (event.code === 'Enter') {
        this.openLevel(this.levelList.selectedIndex);
      }
    } else if (this.state === 'playing') {
      if (event.code === 'Tab' && this.skipTutorial()) event.preventDefault();
    } else if (this.state === 'result') {
      if (event.code === 'Enter' || event.code === 'Space') this.resultDefault();
      else if (event.code === 'KeyR') this.retry();
    }
  };

  /** Throttled browsers make timing unreliable, so leaving the tab aborts the round */
  private readonly onVisibilityChange = () => {
    if (document.hidden && this.state === 'playing') this.backToList();
  };

  /** A level is chosen: hide the list and let the shell show the intro; without an intro, start at once */
  private ready(chart: Chart): void {
    if (!this.context.introduce) {
      void this.start(chart);
      return;
    }
    this.endRound();
    this.closeModal();
    this.chart = chart;
    this.state = 'ready';
    this.setListVisible(false);
    this.context.introduce(chart.id);
  }

  /** Starts a level, with its demos unless skipped (here or in the settings) */
  private async start(chart: Chart, withTutorial = true): Promise<void> {
    this.state = 'starting';
    this.chart = chart;
    await this.context.clock.resume();
    // The scene may have been left, or Esc pressed, while audio resumed
    if (this.destroyed || this.state !== 'starting') return;

    const stops = withTutorial && !loadSkipTutorial() ? tutorialStops(chart) : [];
    this.run = {
      stops,
      demo: null,
      retry: false,
      passed: 0,
      total: stops.reduce((n, stop) => n + stop.actions.length, 0),
      pieceStart: 0,
      nextPhrase: 0,
      hits: [],
      assisted: false,
    };
    this.advance();
  }

  /** Retry from the results: the demos were just played, so play the chart in one go */
  private retry(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    if (this.chart) void this.start(this.chart, false);
  }

  /** Next level in the list, moving the list's selection along */
  private next(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    const index = this.chart ? this.charts.indexOf(this.chart) + 1 : -1;
    const chart = this.charts[index];
    if (!chart) return;
    this.levelList.select(index);
    this.ready(chart);
  }

  private backToList(): void {
    this.endRound();
    this.run = null;
    this.state = 'select';
    this.closeModal();
    this.setListVisible(true);
  }

  /** A round ended: a demo moves on if passed, otherwise repeats; a piece of the chart keeps its judgements. Demos are not scored. */
  private roundEnded(session: S): void {
    const run = this.run;
    if (!run) return;
    if (run.demo !== null) {
      const passed = tutorialPassed(
        session.judgements.map((j) => j.level),
        session.targetCount,
      );
      if (passed) {
        run.demo++;
        run.passed++;
      }
      run.retry = !passed;
    } else {
      run.hits.push(
        ...session.judgements.map((j) => ({
          level: j.level,
          offset: j.offset,
          phrase: run.pieceStart + session.targets[j.event]!.call.phrase,
        })),
      );
    }
    this.advance();
  }

  /**
   * Starts the next round: the next demo if the chart has reached a stop, otherwise the chart from the next
   * unplayed phrase up to the following stop (or the end); after the last phrase, the results.
   */
  private advance(): void {
    const run = this.run;
    const chart = this.chart;
    if (!run || !chart) return;
    const stop = run.stops[0];
    if (stop?.phrase === run.nextPhrase) {
      const demo = run.demo ?? 0;
      const action = stop.actions[demo];
      if (action !== undefined) {
        run.demo = demo;
        this.beginRound(buildTutorialChart(chart, action));
        return;
      }
      run.stops.shift();
    }
    run.demo = null;
    run.retry = false;
    if (run.nextPhrase >= chart.phrases.length) {
      this.finish(run, chart);
      return;
    }
    run.pieceStart = run.nextPhrase;
    run.nextPhrase = run.stops[0]?.phrase ?? chart.phrases.length;
    this.beginRound(chartSegment(chart, run.pieceStart, run.nextPhrase));
  }

  /** Tab during a demo: drop every remaining demo and play the rest of the chart in one go. False outside a demo. */
  private skipTutorial(): boolean {
    const run = this.run;
    if (!run || run.demo === null) return false;
    run.stops = [];
    this.advance();
    return true;
  }

  private beginRound(chart: Chart): void {
    this.endRound();
    this.closeModal();
    this.setListVisible(false);
    this.turnCues = buildTurnCues(chart);
    this.beatGuide.setRound(chart);
    const session = this.createSession(chart);
    this.session = session;
    this.buildRound(session);
    this.cursorCover.eventMode = 'static';
    this.state = 'playing';
  }

  /** The chart's last piece ended: record the best score and open the results */
  private finish(run: LevelRun, chart: Chart): void {
    const summary = summarizeResult(run.hits);
    const assisted = run.assisted;
    const newRecord = recordScore(chart.id, summary.score, assisted);
    const hasNext = this.charts.indexOf(chart) < this.charts.length - 1;
    this.endRound();
    this.closeModal();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.resultDefault = hasNext ? () => this.next() : () => this.retry();
    this.showModal(
      this.openResults({
        title: chart.title,
        summary,
        newRecord,
        assisted,
        hasNext,
        onRetry: () => this.retry(),
        onList: () => this.backToList(),
        onNext: () => this.next(),
      }),
    );
    this.playNow(this.resultSound());
  }

  private endRound(): void {
    this.session?.stop();
    if (this.session) this.clearRound();
    this.session = null;
    this.cursorCover.eventMode = 'none';
    this.turnCues = [];
    this.turnBanner.show(null);
    this.caption.show(null);
    this.beatGuide.view.visible = false;
  }

  /** Demo caption: which practice this is (or "Try again") and how to handle the action */
  private renderCaption(): void {
    const run = this.run;
    const action = run && run.demo !== null ? run.stops[0]?.actions[run.demo] : undefined;
    if (!run || action === undefined) {
      this.caption.show(null);
      return;
    }
    const hint = tutorialHint(action);
    const step = run.retry ? 'Try again' : `Practice ${run.passed + 1} of ${run.total}`;
    this.caption.show({ title: `${step} · ${hint.name}`, how: hint.how });
  }

  /**
   * The beat guide is always shown during demos, and follows the player's toggle while the chart plays
   * (doc/beat-guide.md "Toggle"); using it during the chart marks the score as assisted.
   */
  private renderBeatGuide(beat: number): void {
    const demo = this.run !== null && this.run.demo !== null;
    const on = demo || (this.context.beatGuide?.() ?? false);
    this.beatGuide.view.visible = on;
    if (!on) return;
    this.beatGuide.update(beat);
    if (this.run && !demo) this.run.assisted = true;
  }

  /** Turn banner: squashes and springs back once on each switch */
  private renderTurnBanner(beat: number): void {
    const cue = turnCueAt(this.turnCues, beat);
    if (!cue) {
      this.turnBanner.show(null);
      return;
    }
    this.turnBanner.show(cue.turn, 1 - clamp01((beat - cue.start) / BEATS.squash));
  }
}
