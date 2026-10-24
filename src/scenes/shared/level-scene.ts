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

import { Container, Rectangle } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';
import { listErrors } from '@/game/chart-library.ts';
import { Mailbox, type MailState } from '@/game/mailbox.ts';
import { recordScore } from '@/game/records.ts';
import type { FrameInfo, Scene, SceneContext, SceneMode, TapInfo } from '@/game/scene.ts';
import type { ChartEditor } from '@/editor/chart-editor.ts';
import type { ActionType } from '@/rhythm/actions.ts';
import type { AudioClock } from '@/audio/audio-clock.ts';
import type { PlayerSettings } from '@/game/settings.ts';
import { secondsPerBeat } from '@/rhythm/beat.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { COMBO_BREAK_MIN, ComboTracker, type ComboBreak, type ComboTier } from '@/rhythm/combo.ts';
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
import { HackerIntro } from '@/ui/hacker-intro.ts';
import { HitCounterView } from '@/ui/hit-counter.ts';
import type { EditorPanelHandlers, HackerEditorPanel } from '@/ui/hacker-editor-panel.ts';
import { TextEntry } from '@/ui/text-entry.ts';
import { TurnBanner } from '@/ui/turn-banner.ts';
import { TutorialCaption } from '@/ui/tutorial-caption.ts';
import { SCENE_CATALOG, type SceneId } from '@/scenes/catalog.ts';
import { cutawayDesktopAlpha, cutawayProgress, hasCutaway } from './cutaway.ts';
import { EditorDesk } from './editor-desk.ts';
import type { RoundSession } from './round-session.ts';

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
  /** Played from HackerEditor: `watch` lets the computer do the responses. No results or records */
  editor: { watch: boolean } | null;
  /** Hits in a row across the chart's pieces, demos skipped (doc/combo.md) */
  /** The cheat code was on at some point during the level: no records (doc/cheat-code.md) */
  cheat: boolean;
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
  newRecord: boolean;
  /** The beat guide was on during the chart (doc/beat-guide.md) */
  assisted: boolean;
  /** Another level follows in the list; without one "Next Level" is disabled and Retry is the default */
  hasNext: boolean;
  onRetry: () => void;
  /** The cheat code was on during the level: a "Cheat" tag, never a new record (doc/cheat-code.md) */
  cheat: boolean;
  onList: () => void;
  onNext: () => void;
}

/** What a scene's settings window is given */
export interface SettingsWindowOptions {
  settings: PlayerSettings;
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
  /** Finished charts and the easter egg's message (doc/easter-eggs.md) */
  private readonly mailbox = new Mailbox();
  /** The mailbox's state, read again only when it can change */
  private mailState: MailState = this.mailbox.state;
  /** The new-mail notice has shown during this visit */
  private mailNoticed = false;

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
  /** Draws the scene's combo tier effects behind its windows (doc/combo.md "Tiers"); tier 0 turns them off */
  protected abstract renderComboEffects(
    tier: ComboTier,
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
        onClose: () => this.closeModal(),
        onTestLatency: () => this.openLatencyTest(),
      }),
    );
  }

  /** The message waits unread on a level-list computer and no round is on: the desktop shows its unread mark */
  protected get mailWaiting(): boolean {
    return this.mode === 'levels' && this.mailState === 'unread' && this.session === null;
  }

  /** The desktop's mail program (XP's "E-mail", the Mac's Mail): its inbox over the level list */
  protected openMail(): void {
    this.closeMenus();
    if (this.mode !== 'levels' || !this.desktopIdle) return;
    this.showModal(
      this.openMailWindow({
        message: this.mailState === 'empty' ? null : { read: this.mailState === 'read' },
        onRead: () => {
          this.mailbox.markRead();
          this.mailState = this.mailbox.state;
        },
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

    const session = this.session;
    if (this.state !== 'playing' || !session) return;
    if (this.run?.editor?.watch) session.autoplay(audioTime);
    session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderRound(session, beat, audioTime);
    this.renderCutaway(session, beat);
    this.renderTurnBanner(beat);
    this.renderCaption();
    this.renderBeatGuide(beat);
    this.renderCombo(session, beat, audioTime);

    if (audioTime < session.endTime) return;
    if (this.run && this.context.cheat.active) this.run.cheat = true;
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
    this.endRound();
    this.closeModal();
    this.desk?.entry.destroy();
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  /**
   * Opens the level the URL asked for (#scene/chart), skipping the list; in editor mode opens HackerEditor instead.
   * Subclasses call it once built.
   */
  protected openRequestedLevel(): void {
    if (this.mode === 'editor') {
      this.openEditor();
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
      editor: null,
      combo: new ComboTracker(),
    };
    this.advance();
  }

  /** HackerEditor's Play and Test: the chart from phrase `phrase` to the end, with no demos */
  private async playFromEditor(chart: Chart, phrase: number, watch: boolean): Promise<void> {
    this.closeMenus();
    this.closeModal();
    this.state = 'starting';
    this.chart = chart;
    await this.context.clock.resume();
      cheat: this.context.cheat.active,
    if (this.destroyed || this.state !== 'starting') return;
    this.run = {
      stops: [],
      demo: null,
      retry: false,
      passed: 0,
      total: 0,
      pieceStart: phrase,
      nextPhrase: phrase,
      hits: [],
      assisted: false,
      editor: { watch },
      combo: new ComboTracker(),
    };
    this.advance();
  }

  /** Editor mode: the opening plays over the desktop, then HackerEditor is ready */
  private openEditor(): void {
    const entry = new TextEntry();
    const desk: EditorDesk = new EditorDesk({
      sceneId: this.sceneId,
      library: this.context.library,
      chartFiles: this.context.chartFiles,
      cheat: this.context.cheat.active,
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

  /** Backspace during a demo: drop every remaining demo and play the rest of the chart in one go. False outside a demo. */
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
    // Before the session books its first beats: getting the café ready can take a moment
    if (hasCutaway(chart)) this.context.cutaway.prepare(this.sceneId);
    const session = this.createSession(chart);
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
    const { assisted, cheat } = run;
    // A level played with the cheat code on saves nothing and doesn't count toward the Rickroll (doc/cheat-code.md)
    const newRecord = !cheat && recordScore(chart.id, summary.score, assisted);
    if (!cheat) {
      this.mailbox.recordFinished(chart.id);
      this.mailState = this.mailbox.state;
    }
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
    this.leaveCutaway();
    this.session?.stop();
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
        cheat,
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
      this.renderComboEffects(0, beat, audioTime, beatSeconds);
      return;
    }
    for (const judgement of fresh) {
      const broke = run.combo.record(judgement.level, judgement.shownAt);
      if (broke && broke.lost >= COMBO_BREAK_MIN) this.onComboBreak(broke);
    }
    this.hitCounter.update(run.combo, audioTime, beat, beatSeconds);
    this.renderComboEffects(run.combo.tier, beat, audioTime, beatSeconds);
  }
}
