// The level flow every desktop scene shares: pick a level on the in-game desktop (doc/level-select.md),
// show the shell's level intro, then play the chart in pieces: before the first phrase that uses an action the
// chart stops for its demo, one small round per new action, each repeated until passed (doc/level-design.md
// "Rule 1", ADR 0008); Backspace skips every remaining demo. The results count all pieces together (doc/results.md).
// Subclasses draw the desktop and its widgets; everything is computed from audio time, never from frame deltas.
//
// States: select (choosing in the level list); ready (the shell shows the intro and waits for the first press);
// starting (waiting for audio to resume); playing (a round is running); result (the results window is up).
// Outside `playing` and `ready`, clicks and Space are not rhythm input; only buttons, icons and keys respond.
// On the list the desktop's system menu opens the settings window (doc/settings.md), a modal like the results,
// and its log-off and shut-down items leave the computer,
// and the list imports, exports and deletes charts (doc/chart-import-export.md), reporting in message boxes.
// In editor mode (doc/chart-editor.md) HackerEditor takes the level list's place after the "Welcome Back Hacker"
// opening: Play and Test run the edited chart from the selected phrase, without demos, results or records, and
// return to the editor.
// The Rickroll easter egg (doc/easter-eggs.md): finished charts unlock a message in the mail program, whose link
// opens the browser; both are modal windows over the level list, drawn by each scene.
// In showcase mode (doc/showcase.md) there is no level list: the scene plays a looping tour of its widgets, hit
// effects, rhythm widgets and combo effects one at a time, the computer doing every response; nothing is recorded.

import { Container, Rectangle } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { listErrors } from '@/game/chart-library.ts';
import type { FrameInfo, Scene, SceneContext, SceneMode, TapInfo } from '@/game/scene.ts';
import type { ChartEditor } from '@/editor/chart-editor.ts';
import type { ActionType } from '@/rhythm/actions.ts';
import type { AudioClock } from '@/audio/audio-clock.ts';
import { Sequencer } from '@/audio/sequencer.ts';
import type { SaveProgress } from '@/game/save-progress.ts';
import type { PlayerSettings } from '@/game/settings.ts';
import type { DifficultyControl } from '@/ui/settings-panel.ts';
import { secondsPerBeat } from '@/rhythm/beat.ts';
import type { Chart } from '@/rhythm/chart.ts';
import {
  chartAtDifficulty,
  DEFAULT_DIFFICULTY,
  recordedScore,
  type Difficulty,
} from '@/rhythm/difficulty.ts';
import {
  COMBO_BREAK_MIN,
  COMBO_TIERS,
  ComboTracker,
  tierEffects,
  type ComboBreak,
  type EffectTier,
} from '@/rhythm/combo.ts';
import { summarizeResult, type HitResult, type ResultSummary } from '@/rhythm/result-summary.ts';
import { buildTurnCues, TURN_CUE_LEAD_BEATS, turnCueAt, type TurnCue } from '@/rhythm/turn-cue.ts';
import {
  nextRound,
  tutorialHint,
  tutorialPassed,
  tutorialStops,
  type TutorialProgress,
} from '@/rhythm/tutorial.ts';
import { BEATS, type ThemeColors } from '@/theme/tokens.ts';
import { BEAT_GUIDE_POSITION, BeatGuideView } from '@/ui/beat-guide-view.ts';
import { clamp01 } from '@/ui/easing.ts';
import { HackerIntro } from '@/ui/hacker-intro.ts';
import { HitCounterView } from '@/ui/hit-counter.ts';
import { createJudgementView } from '@/ui/judgement-view.ts';
import type { EditorPanelHandlers, HackerEditorPanel } from '@/ui/hacker-editor-panel.ts';
import { TextEntry } from '@/ui/text-entry.ts';
import { TurnBanner } from '@/ui/turn-banner.ts';
import { TutorialCaption } from '@/ui/tutorial-caption.ts';
import { SCENE_CATALOG, type SceneId } from '@/scenes/catalog.ts';
import { createDrumKit, type DrumKit } from './backing-track.ts';
import { cutawayDesktopAlpha, cutawayProgress, hasCutaway } from './cutaway.ts';
import { EditorDesk } from './editor-desk.ts';
import { ROUND_LEAD_IN, type RoundSession } from './round-session.ts';
import {
  buildShowcase,
  SHOWCASE_BPM,
  showcaseActAt,
  showcaseDrums,
  type Showcase,
  type ShowcaseAct,
} from './showcase.ts';

/** How long after the results appear before Retry / Next accept input (ms), against mashing through */
const RESULT_INPUT_DELAY_MS = 600;
/** Left edge of the demo caption: just right of the 240-wide turn banner (canvas coordinates) */
const CAPTION_X = DESIGN_WIDTH / 2 + 136;
/** Gap between the hit counter and the right edge of the canvas */
const COUNTER_MARGIN = 16;

const LIST_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * How long (s, on the audio scheduling clock) before the hand-over the next round is booked, so its first beat lands
 * exactly on the end beat: more than the sequencer's look-ahead (0.2 s) plus a frame stall
 */
const BOOK_AHEAD = 0.3;
/**
 * The next round takes over the screen this many beats before the round on ends: its "Follow me" banner and the
 * windows of its first call show ahead of the beat. Safe, as turn cue spacing has every press of a phrase that
 * another follows judged by then (doc/prototypes/mvp.md)
 */
const HANDOVER_BEATS = TURN_CUE_LEAD_BEATS;
/** A showcase widget's round keeps playing its last sounds this long after its end (s) before it is stopped */
const SHOWCASE_TAIL_SECONDS = 2;
/** Judgement labels fade out over this many beats after their hold, as in a round */
const JUDGEMENT_FADE_BEATS = 0.25;
/** The combo each tier starts at, where the showcase's hit counter stands */
const TIER_COUNTS: Record<EffectTier, number> = {
  1: COMBO_TIERS[0],
  2: COMBO_TIERS[1],
  3: COMBO_TIERS[2],
};

/** showcase: the showcase computer's tour is on (doc/showcase.md) */
type State = 'select' | 'ready' | 'starting' | 'playing' | 'result' | 'showcase';

/** A showcase act in a given pass of the tour; `key` names it across frames */
interface ShowcaseSlot {
  key: string;
  act: ShowcaseAct;
  /** Beat of the act's start, counted from the tour's first beat 0 */
  start: number;
}

/** The showcase tour in progress (doc/showcase.md) */
interface ShowcaseRun<S> {
  plan: Showcase;
  /** Audio time of the first pass's beat 0; every pass follows on, on one beat grid */
  startTime: number;
  kit: DrumKit;
  /** Drums of each pass booked so far, in pass order */
  drums: Sequencer[];
  /** The widget round on screen */
  round: { key: string; session: S } | null;
  /** The next widget round, booked ahead so its first beat lands on time */
  booked: { key: string; session: S } | null;
  /** Rounds taken off screen whose last sounds still play */
  outgoing: S[];
  /** The other act on screen (hit effect, rhythm widget, combo), set up when it begins */
  act: ShowcaseSlot | null;
  /** The hit effect's judgement label */
  label: Container | null;
  /** The combo standing at the act's count, for the hit counter */
  combo: ComboTracker | null;
}

/**
 * A level in progress: the demo stops still ahead and the round that is on (stops are emptied when the tutorial
 * is skipped), and the chart's judgements so far
 */
interface LevelRun extends TutorialProgress {
  /** The difficulty the level is played on (doc/difficulty.md); HackerEditor runs are Normal, the chart's own tempo */
  difficulty: Difficulty;
  /** The chosen chart at the difficulty's speed: the demos and pieces are cut from it */
  played: Chart;
  /** How many demos the level has (for the caption) */
  total: number;
  /** Judgements of the pieces played, with the chart's phrase numbers */
  hits: HitResult[];
  /** The beat guide was on at some point during the chart */
  assisted: boolean;
  /** The cheat code was on at some point during the level: no records (doc/cheat-code.md) */
  cheat: boolean;
  /** Played from HackerEditor: `watch` lets the computer do the responses. No results or records */
  editor: { watch: boolean } | null;
  /** Hits in a row across the chart's pieces, demos skipped (doc/combo.md) */
  combo: ComboTracker;
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
  /** The level's difficulty: the recorded score is the summary's score times its speed (doc/difficulty.md#scores) */
  difficulty: Difficulty;
  newRecord: boolean;
  /** The beat guide was on during the chart (doc/beat-guide.md) */
  assisted: boolean;
  /** The cheat code was on during the level: a "Cheat" tag, never a new record (doc/cheat-code.md) */
  cheat: boolean;
  /** Another level follows in the list; without one "Next Level" is disabled and Retry is the default */
  hasNext: boolean;
  onRetry: () => void;
  onList: () => void;
  onNext: () => void;
}

/** What a scene's settings window is given */
export interface SettingsWindowOptions {
  settings: PlayerSettings;
  /** The current save's difficulty (doc/difficulty.md) */
  difficulty: DifficultyControl;
  onClose: () => void;
  /** "Test Latency…": swaps the settings window for the latency test window */
  onTestLatency: () => void;
}

/** What a scene's latency test window is given (doc/latency-test.md) */
export interface LatencyTestWindowOptions {
  clock: AudioClock;
  settings: PlayerSettings;
  /** Back to the settings window ("Back", the close button, Esc, or after using the suggested value) */
  onBack: () => void;
}

/** What a scene's message box (XP message box, Mac alert) is given, for chart import and delete */
export interface MessageWindowOptions {
  /** Icon and sound: information, an error, or a question needing confirmation */
  kind: 'info' | 'error' | 'question';
  /** XP title bar; Mac alerts have none */
  title: string;
  /** The main sentence (bold on the Mac) */
  message: string;
  /** More text under it */
  detail?: string;
  /** Two buttons: XP "Yes" / "No", Mac "Cancel" / `verb`. Without it a single "OK" closes the box */
  confirm?: { verb: string; onConfirm: () => void };
  /** OK, No, Cancel or the close button */
  onClose: () => void;
}

/** What a scene's HackerEditor window is given (doc/chart-editor.md) */
export interface EditorWindowOptions {
  editor: ChartEditor;
  /** The scene's actions, for the palette */
  actions: readonly ActionType[];
  textEntry: TextEntry;
  handlers: EditorPanelHandlers;
  /** The window's close button: leave the computer (asking first with unsaved changes) */
  onClose: () => void;
}

/** What a scene's mail window (Outlook Express, Mail) is given (doc/easter-eggs.md) */
export interface MailWindowOptions {
  /** The 4chan message and whether it has been read; null while the inbox is empty */
  message: { read: boolean } | null;
  /** The message was clicked: it is now read */
  onRead: () => void;
  /** The link in the message: the browser replaces the mail window */
  onOpenLink: () => void;
  /** The close button or Esc */
  onClose: () => void;
}

/** What a scene's browser window (Internet Explorer, Safari) is given (doc/easter-eggs.md) */
export interface BrowserWindowOptions {
  /** Where the mirror page puts the YouTube player (SceneContext.overlay, ADR 0014) */
  overlay: HTMLElement;
  /** The close button or Esc */
  onClose: () => void;
}

/** HackerEditor's window on the desktop, in place of the level list */
export interface EditorWindow {
  readonly view: Container;
  readonly panel: HackerEditorPanel;
  /** Inactive behind a message box: dimmed title bar, no clicks */
  setActive(active: boolean): void;
  destroy(): void;
}

/** A modal window on the desktop: a message box, an alert, the results or the settings window */
export interface ModalWindow {
  destroy(): void;
  /** Called every frame, for windows that animate (Aqua's pulsing default button) */
  update?(audioTime: number): void;
  /** Keys while it is open over the level list (held keys repeat); Esc goes to onEscape */
  onKeyDown?(event: KeyboardEvent): void;
  /** Space or a click while it is open over the level list (heard audio time), for the latency test */
  onTap?(audioTime: number): void;
  /** Esc while it is open; without it Esc closes the window */
  onEscape?(): void;
}

export interface LevelSceneOptions {
  id: SceneId;
  theme: ThemeColors;
  /** Vertical centre of the turn banner and demo caption (canvas coordinates) */
  bannerY: number;
  /** Top of the combo hit counter in the top right corner (canvas coordinates), clear of the scene's menu bar */
  counterY: number;
}

export abstract class LevelScene<S extends RoundSession> implements Scene {
  readonly view: Container;
  protected readonly context: SceneContext;
  /** Every chart on this computer, built-in then imported; replaced after an import or delete */
  protected charts: Chart[];
  /** The scene's desktop, drawn in its own virtual screen coordinates; subclasses set its scale */
  protected readonly screen = new Container({ label: 'screen' });
  /** Judgement labels, in canvas coordinates */
  protected readonly judgementLayer = new Container({ label: 'judgements' });
  protected session: S | null = null;
  /**
   * The round after the one on, booked to start on its end beat (doc/level-design.md "Resuming"); the run takes
   * `progress` when it begins. Only while a demo or a piece of the chart has another round after it
   */
  private upcoming: { session: S; progress: TutorialProgress } | null = null;
  /** The round just handed over, whose last sounds still play out; stopped when the next round ends */
  private outgoing: S | null = null;
  /** Replaced by rebuildLevelList after an import or delete; never shown in editor mode */
  protected abstract levelList: LevelList;
  /** The level list and levels, or HackerEditor */
  protected readonly mode: SceneMode;

  private readonly turnBanner: TurnBanner;
  private readonly caption: TutorialCaption;
  /** The beat guide ((((O))), toggled with H) */
  private readonly beatGuide = new BeatGuideView();
  /** Covers the canvas during a round, hiding the player's own cursor so it is not confused with the virtual mouse */
  private readonly cursorCover = new Container({ label: 'cursor-cover' });
  /** Scene sounds outside a round (clicks, the results jingle); a round plays through its session */
  private readonly output: GainNode;
  private readonly sceneId: SceneId;
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
  /** chair-swivel's 3D cutaway is showing (doc/cross-dimension.md) */
  private inCutaway = false;
  /** The combo hit counter (doc/combo.md), shown while the chart plays */
  private readonly hitCounter = new HitCounterView();
  /** Judgements of the current round already counted into the combo */
  private comboSeen = 0;
  /** HackerEditor, in editor mode once opened */
  private desk: { desk: EditorDesk; window: EditorWindow; entry: TextEntry } | null = null;
  /** The new-mail notice has shown during this visit */
  private mailNoticed = false;
  /** The showcase tour, in showcase mode once started */
  private showcase: ShowcaseRun<S> | null = null;

  constructor(context: SceneContext, options: LevelSceneOptions) {
    this.context = context;
    this.view = new Container({ label: options.id });
    this.sceneId = options.id;
    this.mode = context.mode;
    this.charts = this.ownCharts();
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
    // The hit counter sits with the banners, under the cover that hides the player's cursor
    this.hitCounter.view.position.set(DESIGN_WIDTH - COUNTER_MARGIN, options.counterY);
    this.hitCounter.view.visible = false;
    this.view.addChildAt(this.hitCounter.view, this.view.getChildIndex(this.cursorCover));
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Session for one round (the chart itself, a piece of it or a demo chart) with beat 0 at audio time `startTime` */
  protected abstract createSession(chart: Chart, startTime: number): S;
  /** Builds the round's widgets and the virtual mouse */
  protected abstract buildRound(session: S): void;
  /** Tears down what buildRound made */
  protected abstract clearRound(): void;
  /** Draws the round at a beat */
  protected abstract renderRound(session: S, beat: number, audioTime: number): void;
  /** Opens the results window on the desktop */
  protected abstract openResults(options: ResultsWindowOptions): ModalWindow;
  /** Opens the settings window on the desktop */
  protected abstract openSettingsWindow(options: SettingsWindowOptions): ModalWindow;
  /** Opens the latency test window on the desktop */
  protected abstract openLatencyTestWindow(options: LatencyTestWindowOptions): ModalWindow;
  /** Shows or hides the level list window */
  protected abstract setListVisible(visible: boolean): void;
  /** Sound played when a round's results appear */
  protected abstract resultSound(): AudioBuffer;
  /** Opens a message box on the desktop, playing the system's alert sound */
  protected abstract openMessageWindow(options: MessageWindowOptions): ModalWindow;
  /** Replaces the level list with one built from `this.charts`, in the same place */
  protected abstract rebuildLevelList(): void;
  /**
   * Draws the combo effects of `tiers` behind the scene's windows (doc/combo.md "Tiers"): in a round every tier
   * reached (tierEffects); none turns them off. Also called after a break, for its effect
   */
  protected abstract renderComboEffects(
    tiers: readonly EffectTier[],
    beat: number,
    audioTime: number,
    beatSeconds: number,
  ): void;
  /** A combo of COMBO_BREAK_MIN or more broke (doc/combo.md "Combo break") */
  protected abstract onComboBreak(lost: ComboBreak): void;
  /** Stops every combo effect at once (the round ended) */
  protected abstract clearComboEffects(): void;
  /** Opens HackerEditor's window on the desktop (editor mode) */
  protected abstract openEditorWindow(options: EditorWindowOptions): EditorWindow;
  /** The mail program with the easter egg's inbox (doc/easter-eggs.md) */
  protected abstract openMailWindow(options: MailWindowOptions): ModalWindow;
  /** The browser on the 4chan thread */
  protected abstract openBrowserWindow(options: BrowserWindowOptions): ModalWindow;
  /** The message is unread and the level list has come up idle: the new-mail notice, once per visit */
  protected abstract showMailNotice(): void;

  /** HackerEditor's window in editor mode; the scene shows it where the level list would be */
  protected get editorWindow(): EditorWindow | null {
    return this.desk?.window ?? null;
  }

  /** Desktop decoration that runs regardless of state (clocks, list animations) */
  protected updateDesktop(_audioTime: number): void {}

  /** A level was picked in the list, before its intro */
  protected onLevelOpened(): void {}

  /** Closes the desktop's open menus (Start menu, Apple menu); true if one was open */
  protected closeMenus(): boolean {
    return false;
  }

  /** The level list is up with nothing over it: the desktop's own menus may open */
  protected get desktopIdle(): boolean {
    return this.state === 'select' && !this.modal;
  }

  /** The system menu's settings item (or Back from the latency test): the settings window over the level list */
  protected openSettings(): void {
    this.closeMenus();
    if (this.state !== 'select') return;
    this.showModal(
      this.openSettingsWindow({
        settings: this.context.settings,
        difficulty: this.difficultyControl(),
        onClose: () => this.closeModal(),
        onTestLatency: () => this.openLatencyTest(),
      }),
    );
  }

  /** The current save's progress (doc/save-slots.md): best scores, finished charts and the Rickroll message */
  private get progress(): SaveProgress {
    return this.context.saves.requireCurrent();
  }

  /** The settings window's Difficulty group reads and sets the current save's difficulty */
  private difficultyControl(): DifficultyControl {
    const progress = this.progress;
    return {
      get value() {
        return progress.difficulty;
      },
      set: (difficulty) => progress.setDifficulty(difficulty),
      onChange: (listener) => this.context.saves.onChange(listener),
    };
  }

  /** The message waits unread on a level-list computer and no round is on: the desktop shows its unread mark */
  protected get mailWaiting(): boolean {
    return this.mode === 'levels' && this.progress.mailState === 'unread' && this.session === null;
  }

  /** The desktop's mail program (XP's "E-mail", the Mac's Mail): its inbox over the level list */
  protected openMail(): void {
    this.closeMenus();
    if (this.mode !== 'levels' || !this.desktopIdle) return;
    const mail = this.progress.mailState;
    this.showModal(
      this.openMailWindow({
        message: mail === 'empty' ? null : { read: mail === 'read' },
        onRead: () => this.progress.markMailRead(),
        onOpenLink: () => this.openBrowser(),
        onClose: () => this.closeModal(),
      }),
    );
  }

  /** The message's link: the browser replaces the mail window */
  private openBrowser(): void {
    if (this.state !== 'select') return;
    this.showModal(
      this.openBrowserWindow({ overlay: this.context.overlay, onClose: () => this.closeModal() }),
    );
  }

  /** The system menu's log-off and shut-down items: leave the computer like Esc on the list (HackerEditor asks first with unsaved changes) */
  protected leaveComputer(): void {
    this.closeMenus();
    if (!this.desktopIdle) return;
    if (this.desk) this.desk.desk.requestLeave();
    else this.context.leave();
  }

  /** "Test Latency…" in the settings window: the latency test replaces it */
  private openLatencyTest(): void {
    if (this.state !== 'select') return;
    this.showModal(
      this.openLatencyTestWindow({
        clock: this.context.clock,
        settings: this.context.settings,
        onBack: () => this.openSettings(),
      }),
    );
  }

  /** The chart is imported (not built-in), so the list offers to delete it */
  protected isImported(chart: Chart): boolean {
    return this.context.library.isImported(chart.id);
  }

  /** "Import a level": the browser's file picker, then the chart joins the library (doc/chart-import-export.md) */
  protected importChart(): void {
    this.closeMenus();
    if (!this.desktopIdle) return;
    this.context.chartFiles.pick(
      ({ name, text }) => {
        if (this.destroyed || !this.desktopIdle) return;
        const result = this.context.library.import(text);
        if (!result.ok) {
          for (const error of result.errors) console.error(`Import ${name}: ${error}`);
          this.importFailed(`"${name}"`, result.errors);
          return;
        }
        const { chart, replaced } = result;
        const here = chart.scene === this.sceneId;
        this.refreshList(here ? chart.id : this.selectedChartId());
        const notes: string[] = [];
        if (replaced) notes.push('It replaced the imported level with the same id.');
        if (!here) {
          const label = SCENE_CATALOG[chart.scene as SceneId].label;
          notes.push(
            `It is a ${label} level, so it was added to the ${label} computer. Sit at that computer in the café to play it.`,
          );
        }
        this.showMessage({
          kind: 'info',
          title: 'Level Imported',
          message: `Imported "${chart.title}".`,
          ...(notes.length > 0 && { detail: notes.join(' ') }),
        });
      },
      (error) => {
        if (this.destroyed || !this.desktopIdle) return;
        console.error(`Import: ${error}`);
        this.importFailed('The file', [error]);
      },
    );
  }

  /** "Export this level": downloads the selected chart as <id>.json */
  protected exportChart(index: number): void {
    this.closeMenus();
    const chart = this.charts[index];
    if (!chart || !this.desktopIdle) return;
    this.context.chartFiles.save(`${chart.id}.json`, this.context.library.exportText(chart.id));
  }

  /** "Delete this level": imported levels only, after a confirmation */
  protected deleteChart(index: number): void {
    this.closeMenus();
    const chart = this.charts[index];
    if (!chart || !this.isImported(chart) || !this.desktopIdle) return;
    this.showMessage({
      kind: 'question',
      title: 'Confirm Level Delete',
      message: `Are you sure you want to delete "${chart.title}"?`,
      detail: "This can't be undone. Export the level first to keep a copy.",
      confirm: {
        verb: 'Delete',
        onConfirm: () => {
          const result = this.context.library.remove(chart.id);
          if (!result.ok) {
            this.showMessage({
              kind: 'error',
              title: 'Delete Failed',
              message: `"${chart.title}" could not be deleted.`,
              detail: listErrors(result.errors),
            });
            return;
          }
          this.closeModal();
          this.refreshList(null, index);
        },
      },
    });
  }

  /** `what` is the quoted file name, or "The file" when its name isn't known */
  private importFailed(what: string, errors: readonly string[]): void {
    this.showMessage({
      kind: 'error',
      title: 'Import Failed',
      message: `${what} could not be imported.`,
      detail: listErrors(errors),
    });
  }

  private showMessage(options: Omit<MessageWindowOptions, 'onClose'>): void {
    this.showModal(this.openMessageWindow({ ...options, onClose: () => this.closeModal() }));
  }

  private ownCharts(): Chart[] {
    return this.context.library.charts.filter((chart) => chart.scene === this.sceneId);
  }

  private selectedChartId(): string | null {
    return this.charts[this.levelList.selectedIndex]?.id ?? null;
  }

  /** Rebuilds the list from the library, selecting chart `selectId`, or else position `fallback` */
  private refreshList(selectId: string | null, fallback = 0): void {
    this.charts = this.ownCharts();
    this.rebuildLevelList();
    const index = this.charts.findIndex((chart) => chart.id === selectId);
    this.levelList.select(index >= 0 ? index : fallback);
    this.levelList.setActive(!this.modal);
  }

  update({ audioTime }: FrameInfo): void {
    this.updateDesktop(audioTime);
    this.modal?.update?.(audioTime);
    if (!this.mailNoticed && this.mailWaiting && this.desktopIdle) {
      this.mailNoticed = true;
      this.showMailNotice();
    }

    if (this.state === 'showcase') {
      this.updateShowcase(audioTime);
      return;
    }
    const session = this.session;
    if (this.state !== 'playing' || !session) return;
    if (this.run?.editor?.watch) session.autoplay(audioTime);
    if (this.run && this.context.cheat.active) this.run.cheat = true;
    session.update(audioTime);
    this.bookNextRound(session);
    this.upcoming?.session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderRound(session, beat, audioTime);
    this.renderCutaway(session, beat);
    this.renderTurnBanner(beat);
    this.renderCaption();
    this.renderBeatGuide(beat);
    this.renderCombo(session, beat, audioTime);

    const handOver = this.upcoming ? HANDOVER_BEATS * secondsPerBeat(session.chart.bpm) : 0;
    if (audioTime < session.endTime - handOver) return;
    this.roundEnded(session);
  }

  /** Space and clicks are rhythm input only during a round; on the intro the first press starts the level; on the list they go to an open latency test */
  onTap({ audioTime }: TapInfo): void {
    if (this.state === 'select') this.modal?.onTap?.(audioTime);
    else if (this.state === 'playing') this.session?.tap(audioTime);
    else if (this.state === 'ready' && this.chart) void this.start(this.chart);
  }

  /**
   * Esc in a level or on the results goes back to the list. On the list it closes an open menu or window first;
   * with nothing open the shell returns to the street.
   */
  onEscape(): boolean {
    // The showcase has nothing to go back to: Esc leaves for the street
    if (this.mode === 'showcase') return false;
    if (this.state === 'select') {
      if (this.closeMenus()) return true;
      if (!this.modal) {
        if (!this.desk) return false;
        if (!this.desk.window.panel.onEscape()) this.desk.desk.requestLeave();
        return true;
      }
      if (this.modal.onEscape) this.modal.onEscape();
      else this.closeModal();
      return true;
    }
    this.backToList();
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopShowcase();
    this.endRound();
    this.closeModal();
    this.desk?.entry.destroy();
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  /**
   * Opens the level the URL asked for (#scene/chart), skipping the list; in editor mode opens HackerEditor instead,
   * in showcase mode starts the tour. Subclasses call it once built.
   */
  protected openRequestedLevel(): void {
    if (this.mode === 'editor') {
      this.openEditor();
      return;
    }
    if (this.mode === 'showcase') {
      void this.startShowcase();
      return;
    }
    const index = this.charts.findIndex((chart) => chart.id === this.context.chartId);
    if (index < 0) return;
    this.levelList.select(index);
    this.ready(this.charts[index]!);
  }

  /** Shows a modal window on the desktop (replacing any other); the level list goes inactive behind it */
  protected showModal(modal: ModalWindow): void {
    this.closeMenus();
    this.closeModal();
    this.levelList.setActive(false);
    this.desk?.window.setActive(false);
    this.modal = modal;
  }

  protected closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    if (this.state !== 'select') return;
    if (this.desk) this.desk.window.setActive(true);
    else this.levelList.setActive(true);
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

  /** List: arrow keys select, Enter starts. Demo: Backspace skips the tutorial. Results: Enter / Space press the default button, R retries */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.state === 'select' && this.modal?.onKeyDown) {
      if (event.code !== 'Escape') this.modal.onKeyDown(event);
      return;
    }
    if (this.state === 'select' && !this.modal && this.desk) {
      if (this.desk.window.panel.onKeyDown(event)) event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (this.state === 'select' && !this.modal) {
      const move = LIST_MOVES[event.code];
      if (move) {
        event.preventDefault();
        this.levelList.move(...move);
      } else if (event.code === 'Enter') {
        this.closeMenus();
        this.openLevel(this.levelList.selectedIndex);
      }
    } else if (this.state === 'playing') {
      // Not Tab: browsers take it for moving focus
      if (event.code === 'Backspace') {
        event.preventDefault();
        this.skipTutorial();
      }
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
    this.closeMenus();
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

    const stops =
      withTutorial && !this.context.settings.values.skipTutorial ? tutorialStops(chart) : [];
    const difficulty = this.progress.difficulty;
    this.run = {
      difficulty,
      played: chartAtDifficulty(chart, difficulty),
      stops,
      demo: null,
      retry: false,
      passed: 0,
      total: stops.reduce((n, stop) => n + stop.actions.length, 0),
      pieceStart: 0,
      nextPhrase: 0,
      hits: [],
      assisted: false,
      cheat: this.context.cheat.active,
      editor: null,
      combo: new ComboTracker(),
    };
    this.firstRound(chart);
  }

  /** HackerEditor's Play and Test: the chart from phrase `phrase` to the end, with no demos */
  private async playFromEditor(chart: Chart, phrase: number, watch: boolean): Promise<void> {
    this.closeMenus();
    this.closeModal();
    this.state = 'starting';
    this.chart = chart;
    await this.context.clock.resume();
    if (this.destroyed || this.state !== 'starting') return;
    this.run = {
      difficulty: DEFAULT_DIFFICULTY,
      played: chart,
      stops: [],
      demo: null,
      retry: false,
      passed: 0,
      total: 0,
      pieceStart: phrase,
      nextPhrase: phrase,
      hits: [],
      assisted: false,
      cheat: this.context.cheat.active,
      editor: { watch },
      combo: new ComboTracker(),
    };
    this.firstRound(chart);
  }

  /** Editor mode: the opening plays over the desktop, then HackerEditor is ready */
  private openEditor(): void {
    const entry = new TextEntry();
    const desk: EditorDesk = new EditorDesk({
      sceneId: this.sceneId,
      library: this.context.library,
      chartFiles: this.context.chartFiles,
      showMessage: (options) => this.showMessage(options),
      closeMessage: () => this.closeModal(),
      choose: (title, items, onPick) => editorWindow.panel.showChooser(title, items, onPick),
      note: (text) => editorWindow.panel.setNote(text),
      play: (chart, phrase, watch) => void this.playFromEditor(chart, phrase, watch),
      leave: () => this.context.leave(),
    });
    const editorWindow = this.openEditorWindow({
      editor: desk.editor,
      actions: SCENE_CATALOG[this.sceneId].actions,
      textEntry: entry,
      handlers: desk.handlers,
      onClose: () => {
        if (this.state === 'select' && !this.modal) desk.requestLeave();
      },
    });
    this.desk = { desk, window: editorWindow, entry };
    this.setListVisible(true);
    const intro = new HackerIntro(() => this.closeModal());
    this.view.addChild(intro.view);
    this.showModal({
      update: () => intro.update(),
      destroy: () => intro.destroy(),
      // The opening is not skippable (doc/chart-editor.md)
      onEscape: () => {},
    });
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
    if (run.demo === null) {
      run.hits.push(
        ...session.judgements.map((j) => ({
          level: j.level,
          offset: j.offset,
          phrase: run.pieceStart + session.targets[j.event]!.call.phrase,
        })),
      );
    }
    const upcoming = this.upcoming;
    if (upcoming) {
      this.upcoming = null;
      Object.assign(run, upcoming.progress);
      this.beginRound(upcoming.session, true);
      return;
    }
    // Not booked ahead (a demo's last press was judged too late): start on a later bar of the same beat grid
    this.advance(this.demoPassed(session), this.nextBarTime(session.endTime, session.chart));
  }

  /**
   * Shortly before a round with another after it ends, works out that round and books it to start on the end
   * beat with no count-in, so demos and the chart's pieces follow on in one beat (doc/level-design.md "One beat
   * throughout"). A demo waits until every press is judged, since passing decides what comes next.
   */
  private bookNextRound(session: S): void {
    const run = this.run;
    const chart = this.chart;
    if (this.upcoming || !run || !chart) return;
    const handOver = HANDOVER_BEATS * secondsPerBeat(session.chart.bpm);
    const bookAt = session.endTime - handOver - BOOK_AHEAD;
    if (this.context.clock.context.currentTime < bookAt) return;
    if (run.demo !== null && session.judgements.length < session.targetCount) return;
    const next = nextRound(run.played, run, this.demoPassed(session), true);
    if (!next.chart) return;
    session.handOff();
    this.beatGuide.appendRound(next.chart, session.chart.endBeat);
    this.upcoming = {
      session: this.createSession(next.chart, session.endTime),
      progress: next.progress,
    };
  }

  /** Whether the round on, if a demo, passed */
  private demoPassed(session: S): boolean {
    return tutorialPassed(
      session.judgements.map((j) => j.level),
      session.targetCount,
    );
  }

  /**
   * Moves the run on to the next round, with its count-in, and beat 0 at `startTime`; after the last phrase, the
   * results. Rounds booked ahead to follow on go through bookNextRound instead.
   */
  private advance(demoPassed: boolean, startTime: number): void {
    const run = this.run;
    const chart = this.chart;
    if (!run || !chart) return;
    const next = nextRound(run.played, run, demoPassed, false);
    Object.assign(run, next.progress);
    if (!next.chart) {
      this.finish(run, chart);
      return;
    }
    this.beginRound(this.createSession(next.chart, startTime));
  }

  /**
   * Backspace during a demo: drop every remaining demo and play the rest of the chart in one go, from the demo's
   * next bar line. False outside a demo.
   */
  private skipTutorial(): boolean {
    const run = this.run;
    const session = this.session;
    if (!run || run.demo === null || !session) return false;
    run.stops = [];
    this.dropUpcoming();
    this.advance(false, this.nextBarTime(session.startTime, session.chart));
    return true;
  }

  /** Audio time of beat 0 for a round that doesn't follow on from another */
  private leadIn(): number {
    return this.context.clock.context.currentTime + ROUND_LEAD_IN;
  }

  /** The first bar line of `chart`'s grid, counting from the bar line at `from`, that is still far enough ahead to book */
  private nextBarTime(from: number, chart: Chart): number {
    const bar = chart.beatsPerBar * secondsPerBeat(chart.bpm);
    return from + Math.ceil(Math.max(0, this.leadIn() - from) / bar) * bar;
  }

  /**
   * Runs the level's first round with beat 0 shortly from now. Before anything is booked: getting chair-swivel's
   * café ready can take a moment, so it happens here once rather than while a round plays.
   */
  private firstRound(chart: Chart): void {
    if (hasCutaway(chart)) this.context.cutaway.prepare(this.sceneId);
    this.advance(false, this.leadIn());
  }

  private dropUpcoming(): void {
    this.upcoming?.session.stop();
    this.upcoming = null;
  }

  /** Shows a round whose progress the run has taken; `handOver`: it follows on, so the round on's sounds play out */
  private beginRound(session: S, handOver = false): void {
    this.endRound(handOver);
    this.closeModal();
    this.setListVisible(false);
    this.turnCues = buildTurnCues(session.chart);
    this.beatGuide.setRound(session.chart, this.hasNextRound());
    this.session = session;
    this.buildRound(session);
    this.cursorCover.eventMode = 'static';
    this.state = 'playing';
  }

  /** The chart's last piece ended: record the best score and open the results */
  private finish(run: LevelRun, chart: Chart): void {
    if (run.editor) {
      // Back to the editor, with the test's judgements in its status line
      const counts = { perfect: 0, good: 0, miss: 0 };
      for (const hit of run.hits) counts[hit.level]++;
      this.backToList();
      if (!run.editor.watch) {
        this.desk?.window.panel.setNote(
          `Test: ${counts.perfect} Perfect, ${counts.good} Good, ${counts.miss} Miss`,
        );
      }
      return;
    }
    const summary = summarizeResult(run.hits);
    const { assisted, cheat, difficulty } = run;
    const score = recordedScore(summary.score, difficulty);
    // A level played with the cheat code on saves nothing and doesn't count toward the Rickroll (doc/cheat-code.md)
    const newRecord =
      !cheat && this.progress.recordScore(chart.id, { score, assisted, difficulty });
    if (!cheat) this.progress.recordFinished(chart.id);
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
        difficulty,
        newRecord,
        assisted,
        cheat,
        hasNext,
        onRetry: () => this.retry(),
        onList: () => this.backToList(),
        onNext: () => this.next(),
      }),
    );
    this.playNow(this.resultSound());
  }

  /** Whether another round comes after the one on (a demo always has one) */
  private hasNextRound(): boolean {
    const run = this.run;
    const chart = this.chart;
    return (
      run !== null && chart !== null && (run.demo !== null || run.nextPhrase < chart.phrases.length)
    );
  }

  /** Tears the round on down; `handOver` keeps its sounds playing out while the next round begins */
  private endRound(handOver = false): void {
    this.dropUpcoming();
    this.outgoing?.stop();
    this.outgoing = null;
    this.leaveCutaway();
    if (handOver) this.outgoing = this.session;
    else this.session?.stop();
    if (this.session) this.clearRound();
    this.session = null;
    this.cursorCover.eventMode = 'none';
    this.turnCues = [];
    this.turnBanner.show(null);
    this.caption.show(null);
    this.beatGuide.view.visible = false;
    this.comboSeen = 0;
    this.hitCounter.view.visible = false;
    this.clearComboEffects();
  }

  /**
   * chair-swivel's cutaway: the 3D café shows under this canvas while the desktop crossfades out and back in;
   * banners, judgements and the beat guide stay on top. The café is captured from the desktop before it fades.
   */
  private renderCutaway(session: S, beat: number): void {
    const progress = cutawayProgress(session, beat);
    if (progress === null) {
      this.leaveCutaway();
      return;
    }
    this.context.cutaway.show(this.sceneId, progress, this.screen);
    this.inCutaway = true;
    this.screen.alpha = cutawayDesktopAlpha(progress);
  }

  private leaveCutaway(): void {
    if (!this.inCutaway) return;
    this.inCutaway = false;
    this.screen.alpha = 1;
    this.context.cutaway.hide();
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
    const on = demo || this.context.settings.values.beatGuide;
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

  /**
   * Counts the round's new judgements into the combo and draws the hit counter and the scene's tier effects.
   * Only the chart counts: demos and HackerEditor runs show neither (doc/combo.md "Counting").
   */
  private renderCombo(session: S, beat: number, audioTime: number): void {
    const run = this.run;
    const fresh = session.judgements.slice(this.comboSeen);
    this.comboSeen = session.judgements.length;
    const counting = run !== null && run.demo === null && run.editor === null;
    this.hitCounter.view.visible = counting;
    const beatSeconds = secondsPerBeat(session.chart.bpm);
    if (!run || !counting) {
      this.renderComboEffects([], beat, audioTime, beatSeconds);
      return;
    }
    for (const judgement of fresh) {
      const broke = run.combo.record(judgement.level, judgement.shownAt);
      if (broke && broke.lost >= COMBO_BREAK_MIN) this.onComboBreak(broke);
    }
    this.hitCounter.update(run.combo, audioTime, beat, beatSeconds);
    this.renderComboEffects(tierEffects(run.combo.tier), beat, audioTime, beatSeconds);
  }

  // ---------- Showcase (doc/showcase.md) ----------

  /** Starts the tour on the empty desktop, beat 0 shortly from now */
  private async startShowcase(): Promise<void> {
    this.state = 'starting';
    this.setListVisible(false);
    await this.context.clock.resume();
    if (this.destroyed || this.state !== 'starting') return;
    const plan = buildShowcase(this.sceneId, SCENE_CATALOG[this.sceneId].actions);
    if (plan.acts.some((act) => act.kind === 'widget' && hasCutaway(act.chart))) {
      this.context.cutaway.prepare(this.sceneId);
    }
    this.showcase = {
      plan,
      startTime: this.leadIn(),
      kit: createDrumKit(this.context.clock.context),
      drums: [],
      round: null,
      booked: null,
      outgoing: [],
      act: null,
      label: null,
      combo: null,
    };
    // The player's cursor would look like part of the tour
    this.cursorCover.eventMode = 'static';
    this.state = 'showcase';
  }

  /** One frame of the tour: books drums and widget rounds ahead, then draws the act on, all from the audio clock */
  private updateShowcase(audioTime: number): void {
    const run = this.showcase;
    if (!run) return;
    const now = this.context.clock.context.currentTime;
    const beatSeconds = secondsPerBeat(SHOWCASE_BPM);
    const beatOf = (time: number) => (time - run.startTime) / beatSeconds;

    // Each pass's drums, booked shortly before the pass starts
    const passSeconds = run.plan.passBeats * beatSeconds;
    while (run.startTime + run.drums.length * passSeconds < now + BOOK_AHEAD) {
      run.drums.push(
        new Sequencer(this.context.clock.context, this.output, showcaseDrums(run.plan, run.kit), {
          startTime: run.startTime + run.drums.length * passSeconds,
          bpm: SHOWCASE_BPM,
        }),
      );
    }
    for (const drums of run.drums.slice(-2)) drums.schedule();

    // A widget's round is booked ahead, and is on screen from half a beat before its start to half a beat before its end
    const ahead = this.showcaseSlot(run, beatOf(now + BOOK_AHEAD) + HANDOVER_BEATS);
    if (
      ahead?.act.kind === 'widget' &&
      run.round?.key !== ahead.key &&
      run.booked?.key !== ahead.key
    ) {
      run.booked?.session.stop();
      run.booked = { key: ahead.key, session: this.bookShowcaseRound(run, ahead) };
    }
    const beat = beatOf(audioTime);
    const shown = this.showcaseSlot(run, beat + HANDOVER_BEATS);
    const widget = shown?.act.kind === 'widget' ? shown : null;
    if (run.round && run.round.key !== widget?.key) this.dropShowcaseRound(run);
    if (widget && !run.round) {
      const booked = run.booked?.key === widget.key ? run.booked.session : null;
      if (booked) run.booked = null;
      const session = booked ?? this.bookShowcaseRound(run, widget);
      run.round = { key: widget.key, session };
      this.session = session;
      this.buildRound(session);
    }
    if (run.round) {
      // The computer makes every press on its beat; its judgement labels stay hidden
      const session = run.round.session;
      session.autoplay(audioTime);
      session.update(audioTime);
      const roundBeat = session.beatAt(audioTime);
      this.renderRound(session, roundBeat, audioTime);
      this.renderCutaway(session, roundBeat);
    }
    run.outgoing = run.outgoing.filter((session) => {
      if (audioTime < session.endTime + SHOWCASE_TAIL_SECONDS) return true;
      session.stop();
      return false;
    });

    // Every other act, from its first beat to its end
    const slot = this.showcaseSlot(run, beat);
    const act = slot && slot.act.kind !== 'widget' ? slot : null;
    if (run.act?.key !== act?.key) {
      this.leaveShowcaseAct(run);
      if (act) this.enterShowcaseAct(run, act, beatSeconds);
    }
    this.judgementLayer.visible = act?.act.kind === 'judgement';
    if (act) this.drawShowcaseAct(run, act, beat, audioTime, beatSeconds);
  }

  /** The act at `beat` (from the tour's first beat 0) and which pass it is in; null in a count-in */
  private showcaseSlot(run: ShowcaseRun<S>, beat: number): ShowcaseSlot | null {
    const { passBeats } = run.plan;
    const pass = Math.floor(beat / passBeats);
    const act = showcaseActAt(run.plan, beat - pass * passBeats);
    if (!act) return null;
    return { key: `${pass}:${act.start}`, act, start: pass * passBeats + act.start };
  }

  /** A widget's round with beat 0 on its act's first beat; its closing hit gives way to what follows */
  private bookShowcaseRound(run: ShowcaseRun<S>, slot: ShowcaseSlot): S {
    if (slot.act.kind !== 'widget') throw new Error(`Showcase act ${slot.key} is not a widget`);
    const session = this.createSession(
      slot.act.chart,
      run.startTime + slot.start * secondsPerBeat(SHOWCASE_BPM),
    );
    session.handOff();
    return session;
  }

  /** Takes the widget's round off screen; its last sounds play out */
  private dropShowcaseRound(run: ShowcaseRun<S>): void {
    const round = run.round;
    if (!round) return;
    this.leaveCutaway();
    this.clearRound();
    this.session = null;
    run.round = null;
    run.outgoing.push(round.session);
  }

  private enterShowcaseAct(run: ShowcaseRun<S>, slot: ShowcaseSlot, beatSeconds: number): void {
    run.act = slot;
    const { act } = slot;
    const startTime = run.startTime + slot.start * beatSeconds;
    switch (act.kind) {
      case 'judgement': {
        const label = createJudgementView(act.level);
        label.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
        this.judgementLayer.addChild(label);
        run.label = label;
        break;
      }
      case 'beat-guide':
        this.beatGuide.setRound(act.chart, false);
        this.beatGuide.view.visible = true;
        break;
      case 'turn-banner':
        this.turnCues = buildTurnCues(act.chart);
        break;
      case 'combo':
        // The counter rolls up to the tier's count on the act's first beat; the tiers below show too, as in a round
        run.combo = comboAt(TIER_COUNTS[act.tier], startTime);
        this.hitCounter.view.visible = true;
        this.renderComboEffects(tierEffects(act.tier), slot.start, startTime, beatSeconds);
        break;
      case 'combo-break': {
        // A full combo is lost on the act's first beat: the counter flashes back to 0 and the break effect plays
        const combo = comboAt(TIER_COUNTS[3], startTime - beatSeconds);
        const broke = combo.record('miss', startTime);
        if (broke) this.onComboBreak(broke);
        run.combo = combo;
        this.hitCounter.view.visible = true;
        break;
      }
      case 'widget':
        throw new Error(`Showcase widget ${act.action} is shown as a round`);
    }
  }

  private drawShowcaseAct(
    run: ShowcaseRun<S>,
    slot: ShowcaseSlot,
    beat: number,
    audioTime: number,
    beatSeconds: number,
  ): void {
    const { act } = slot;
    const since = beat - slot.start;
    switch (act.kind) {
      case 'judgement': {
        const label = run.label;
        if (!label) throw new Error('The hit effect has no label');
        // Squash and spring back, hold, fade out, as in a round
        const squash = 1 - clamp01(since / BEATS.squash);
        label.scale.set(1 + 0.25 * squash, 1 - 0.25 * squash);
        label.alpha = 1 - clamp01((since - BEATS.judgementHold) / JUDGEMENT_FADE_BEATS);
        break;
      }
      case 'beat-guide':
        this.beatGuide.update(since);
        break;
      case 'turn-banner':
        this.renderTurnBanner(since);
        break;
      case 'combo':
      case 'combo-break': {
        const combo = run.combo;
        if (!combo) throw new Error('The combo act has no combo');
        this.hitCounter.update(combo, audioTime, beat, beatSeconds);
        const tiers = act.kind === 'combo' ? tierEffects(act.tier) : [];
        this.renderComboEffects(tiers, beat, audioTime, beatSeconds);
        break;
      }
      case 'widget':
        throw new Error(`Showcase widget ${act.action} is shown as a round`);
    }
  }

  /** Puts away whatever the act on set up */
  private leaveShowcaseAct(run: ShowcaseRun<S>): void {
    run.act = null;
    run.label?.destroy({ children: true });
    run.label = null;
    run.combo = null;
    this.beatGuide.view.visible = false;
    this.turnCues = [];
    this.turnBanner.show(null);
    this.hitCounter.view.visible = false;
    this.clearComboEffects();
  }

  /** Stops every sound of the tour and takes it off screen */
  private stopShowcase(): void {
    const run = this.showcase;
    if (!run) return;
    this.showcase = null;
    this.dropShowcaseRound(run);
    this.leaveShowcaseAct(run);
    run.booked?.session.stop();
    for (const session of run.outgoing) session.stop();
    for (const drums of run.drums) drums.stop();
  }
}

/** A combo standing at `count`, its last hit heard at `lastHit` (s), so the hit counter rolls up to it then */
function comboAt(count: number, lastHit: number): ComboTracker {
  const combo = new ComboTracker();
  for (let i = 1; i < count; i++) combo.record('perfect', lastHit - 1);
  combo.record('perfect', lastHit);
  return combo;
}
