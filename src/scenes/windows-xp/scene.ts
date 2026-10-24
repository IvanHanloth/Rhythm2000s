// Scene: the Windows XP desktop (doc/scenes/windows-xp.md). Levels are picked in an Explorer window; on the list,
// "start" opens the Start menu, whose "Control Panel" opens the settings window (doc/settings.md)
// and whose "Log Off" / "Turn Off Computer" leave the computer.
// The XP interface is drawn at original pixel size on a 1024×576 virtual screen scaled up to the canvas;
// the turn banner and judgement labels use canvas coordinates.

import { Container, Rectangle } from 'pixi.js';
import type { SceneContext, SceneEntry } from '@/game/scene.ts';
import type { Chart } from '@/rhythm/chart.ts';
import type { ComboTier } from '@/rhythm/combo.ts';
import { BEATS, THEMES } from '@/theme/tokens.ts';
import { clamp01, easeOutBack } from '@/ui/easing.ts';
import { createJudgementView } from '@/ui/judgement-view.ts';
import { SCENE_CATALOG } from '@/scenes/catalog.ts';
import type { Turn } from '@/scenes/shared/cursor-path.ts';
import {
  type EditorWindowOptions,
  type LatencyTestWindowOptions,
  LevelScene,
  type MessageWindowOptions,
  type ResultsWindowOptions,
  type SettingsWindowOptions,
} from '@/scenes/shared/level-scene.ts';
import type { JudgementRecord } from '@/scenes/shared/round-session.ts';
import { preloadXpAssets, XP_CURSOR, xpAssets } from './assets.ts';
import { XpDesktop } from './components/desktop.ts';
import { EDITOR_ICON, EDITOR_TITLE, XpEditorWindow } from './editor-window.ts';
import { XpMessageBox } from './components/message-box.ts';
import {
  WORK_AREA_HEIGHT,
  XP_SCALE,
  XP_SCREEN_HEIGHT,
  XP_SCREEN_WIDTH,
} from './components/screen.ts';
import { CONTROL_PANEL, LOG_OFF, TURN_OFF_COMPUTER, XpStartMenu } from './components/start-menu.ts';
import { XpTaskbar } from './components/taskbar.ts';
import { isDialogKind, type DialogKind } from './dialog-kinds.ts';
import { XpLatencyTestWindow } from './latency-test-window.ts';
import { EXPLORER_TITLE, XpLevelSelect } from './level-select.ts';
import { XpComboEffects } from './combo-effects.ts';
import { XpMessageWindow } from './message-window.ts';
import { XpResultsWindow } from './results-window.ts';
import { XpSession, type XpTarget } from './session.ts';
import { XpSettingsWindow } from './settings-window.ts';
import { ShellTargetsView, windowSlotIndex } from './shell-targets-view.ts';
import { createXpSongSounds, type XpSongSounds } from './song.ts';
import { VirtualMouse } from './virtual-mouse.ts';
import { WaitHoldView } from './wait-hold-view.ts';

/** Turn banner centre (canvas coordinates), above the top row of message boxes */
const BANNER_Y = 38;
/** Top of the combo hit counter (canvas coordinates) */
const COUNTER_Y = 12;

/** Message box centres in a phrase (virtual screen), used in order of the box's index in the phrase */
const SLOTS = [
  { x: 205, y: 135 },
  { x: 512, y: 112 },
  { x: 822, y: 150 },
  { x: 265, y: 335 },
  { x: 578, y: 312 },
  { x: 842, y: 368 },
];
/** chair-swivel: the virtual mouse clicks empty desktop here, and its judgement shows above (virtual screen, provisional) */
const CHAIR_SPOT = { x: XP_SCREEN_WIDTH / 2, y: 260 };
/** Body text wraps beyond this width */
const POPUP_TEXT_WIDTH = 210;

/** Message box texts in the voice of period pop-up ads and system notices, all original */
const POPUP_TEXTS: Record<DialogKind, { title: string; text: string }[]> = {
  'dialog-info': [
    {
      title: 'Congratulations!',
      text: 'You are our 100,000th visitor! Click here to claim your prize.',
    },
    { title: 'New Message', text: 'You have 1 new friend request.' },
    {
      title: 'Network Connection',
      text: 'You are now connected to the Internet. Speed: 56.0 Kbps',
    },
    { title: 'Reminder', text: 'Your mailbox is full. Please delete some messages.' },
  ],
  'dialog-warning': [
    { title: 'Security Warning', text: '3 suspicious files were found. Scan your computer now.' },
    { title: 'Low Disk Space', text: 'You are running out of disk space on Local Disk (C:).' },
    { title: 'Low Battery', text: 'Your battery is at 5%. Plug in your computer now.' },
  ],
  'dialog-error': [
    {
      title: 'Application Error',
      text: 'This program has performed an illegal operation and will be shut down.',
    },
    { title: 'File Not Found', text: 'Cannot find the file C:\\WINDOWS\\system32\\fun.dll.' },
    { title: 'Page Error', text: 'The page cannot be displayed. Check your network connection.' },
  ],
  'dialog-question': [
    {
      title: 'Free Download',
      text: 'Download the newest animated screensaver? It is totally FREE!',
    },
    { title: 'System Alert', text: 'Your computer is running slowly. Optimize it now?' },
    {
      title: 'Notepad',
      text: 'The text in the Untitled file has changed.\nDo you want to save the changes?',
    },
  ],
};

/** After a Miss the title bar flashes like clicking outside a modal box: step and duration (beats) */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
/** Fade-out of message boxes and judgement labels (beats) */
const FADE_BEATS = 0.25;

/** Explorer window on the virtual screen (the 1120×630 mock-up scaled to 1024×576) */
const EXPLORER = { x: 80, y: 19, width: 864, height: 504 };
/** HackerEditor's window: nearly the whole work area (doc/chart-editor.md) */
const EDITOR = { x: 10, y: 6, width: 1004, height: 534 };

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

class WindowsXpScene extends LevelScene<XpSession> {
  protected levelList: XpLevelSelect;
  private readonly sounds: XpSongSounds;
  private readonly desktop = new XpDesktop();
  private readonly taskbar = new XpTaskbar({
    tasks: [
      this.context.mode === 'editor'
        ? { icon: EDITOR_ICON, label: EDITOR_TITLE }
        : { icon: 'folder-open', label: EXPLORER_TITLE },
    ],
  });
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  /** The Start menu the player opens on the level list, above the taskbar */
  private readonly menuLayer = new Container({ label: 'menus' });
  /** Virtual mouse and context menu, on top of the XP interface */
  private readonly pointerLayer = new Container({ label: 'pointer' });
  private startMenu: XpStartMenu | null = null;
  /** Icons hopping, the brighter sky and the 3D Pipes (doc/combo.md) */
  private readonly comboEffects: XpComboEffects;

  /** One message box per chart event; null for events that are not message boxes */
  private popups: (XpMessageBox | null)[] = [];
  /** Balloons, program windows, Start menu, Recycle Bin files (doc/scenes/windows-xp-levels.md) */
  private shellView: ShellTargetsView | null = null;
  /** Download window and volume control (doc/scenes/windows-xp-levels.md "Waits and holds") */
  private waitHoldView: WaitHoldView | null = null;
  private virtualMouse: VirtualMouse | null = null;
  private judgementViews: ActiveJudgement[] = [];
  private shownJudgements = 0;

  constructor(context: SceneContext) {
    super(context, {
      id: windowsXpScene.id,
      theme: THEMES.xp,
      bannerY: BANNER_Y,
      counterY: COUNTER_Y,
    });
    this.comboEffects = new XpComboEffects(this.desktop);
    this.sounds = createXpSongSounds(context.clock.context, xpAssets().sounds);
    this.levelList = this.createLevelList();
    this.taskbar.setTaskActive(0, true);

    this.screen.scale.set(XP_SCALE);
    this.taskbar.view.y = XP_SCREEN_HEIGHT - this.taskbar.view.height;
    this.screen.addChild(
      this.desktop.view,
      this.levelList.view,
      this.windowLayer,
      this.dialogLayer,
      this.taskbar.view,
      this.menuLayer,
      this.pointerLayer,
    );

    // A click anywhere outside the open Start menu closes it, Start included (the original toggles)
    this.menuLayer.eventMode = 'static';
    this.menuLayer.on('pointerdown', (event) => {
      if (event.target === this.menuLayer) this.closeMenus();
    });
    const start = this.taskbar.startButton.view;
    start.eventMode = 'static';
    start.on('pointerdown', () => this.openStartMenu());

    if (this.charts.length === 0 && this.mode === 'levels') this.showNoCharts();
    this.openRequestedLevel();
  }

  private createLevelList(): XpLevelSelect {
    const list = new XpLevelSelect({
      charts: this.charts,
      width: EXPLORER.width,
      height: EXPLORER.height,
      onStart: (index) => this.openLevel(index),
      onBack: () => this.context.leave(),
      isImported: (chart) => this.isImported(chart),
      onImport: () => this.importChart(),
      onExport: (index) => this.exportChart(index),
      onDelete: (index) => this.deleteChart(index),
    });
    list.view.position.set(EXPLORER.x, EXPLORER.y);
    return list;
  }

  protected rebuildLevelList(): void {
    const old = this.levelList;
    this.levelList = this.createLevelList();
    this.screen.addChildAt(this.levelList.view, this.screen.getChildIndex(old.view));
    old.destroy();
  }

  /** Message box in the middle of the work area, with the XP alert sound of its icon */
  protected openMessageWindow(options: MessageWindowOptions): XpMessageWindow {
    const message = new XpMessageWindow(options);
    message.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(message.view);
    const sound = {
      info: 'dialog-info',
      error: 'dialog-error',
      question: 'dialog-warning',
    } as const;
    this.playNow(this.sounds.dialogs[sound[options.kind]]);
    return message;
  }

  protected renderComboEffects(tier: ComboTier, beat: number, audioTime: number): void {
    this.comboEffects.update(tier, beat, audioTime);
  }

  /** Hardware Remove: the unplug chime, a short "disconnected" */
  protected onComboBreak(): void {
    this.playNow(xpAssets().sounds.comboBreak);
  }

  protected clearComboEffects(): void {
    this.comboEffects.clear();
  }

  protected override updateDesktop(): void {
    // The taskbar clock is decoration showing local time, unrelated to the rhythm
    this.taskbar.setClock(new Date());
  }

  protected override onLevelOpened(): void {
    this.playNow(this.sounds.close);
  }

  protected createSession(chart: Chart): XpSession {
    return new XpSession(this.context, chart, this.sounds);
  }

  protected buildRound(session: XpSession): void {
    this.popups = session.targets.map((target, event) => this.createPopup(session, target, event));
    this.shellView = new ShellTargetsView({
      session,
      desktop: this.desktop,
      taskbar: this.taskbar,
      windowLayer: this.windowLayer,
      slots: SLOTS,
    });
    // Files lie on the desktop (below windows); balloons and the Start menu sit above the taskbar, below the mouse
    this.screen.addChildAt(
      this.shellView.desktopLayer,
      this.screen.getChildIndex(this.desktop.view) + 1,
    );
    this.screen.addChildAt(
      this.shellView.overlayLayer,
      this.screen.getChildIndex(this.pointerLayer),
    );
    this.waitHoldView = new WaitHoldView({ session, taskbar: this.taskbar });
    this.screen.addChildAt(this.waitHoldView.layer, this.screen.getChildIndex(this.pointerLayer));
    this.virtualMouse = new VirtualMouse(session, this.desktop, (target, event, turn) =>
      this.clickPoints(target, event, turn),
    );
    this.pointerLayer.addChild(this.virtualMouse.view);
  }

  protected clearRound(): void {
    for (const popup of this.popups) popup?.destroy();
    this.popups = [];
    this.shellView?.destroy();
    this.shellView = null;
    this.waitHoldView?.destroy();
    this.waitHoldView = null;
    this.virtualMouse?.destroy();
    this.virtualMouse = null;
    for (const { view } of this.judgementViews) view.destroy({ children: true });
    this.judgementViews = [];
    this.shownJudgements = 0;
  }

  protected renderRound(session: XpSession, beat: number): void {
    const focus = this.focusedWindow(session, beat);
    this.renderPopups(session, beat, focus);
    this.shellView!.update(beat, focus);
    this.virtualMouse!.update(beat);
    this.waitHoldView!.update(beat, this.virtualMouse!.position);
    this.renderJudgements(session, beat);
  }

  protected openResults(options: ResultsWindowOptions): XpResultsWindow {
    const results = new XpResultsWindow(options);
    results.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(results.view);
    return results;
  }

  /**
   * Explorer (or HackerEditor in editor mode) in front presses its taskbar button; during a round it is hidden and
   * the button pops up
   */
  protected setListVisible(visible: boolean): void {
    const editor = this.editorWindow;
    this.levelList.view.visible = visible && !editor;
    this.levelList.setActive(visible && !editor);
    if (editor) {
      editor.view.visible = visible;
      editor.setActive(visible);
    }
    this.taskbar.setTaskActive(0, visible);
  }

  protected openEditorWindow(options: EditorWindowOptions): XpEditorWindow {
    const editor = new XpEditorWindow(options, EDITOR.width, EDITOR.height);
    editor.view.position.set(EDITOR.x, EDITOR.y);
    this.screen.addChildAt(editor.view, this.screen.getChildIndex(this.levelList.view) + 1);
    return editor;
  }

  protected resultSound(): AudioBuffer {
    return this.sounds.result;
  }

  protected openSettingsWindow(options: SettingsWindowOptions): XpSettingsWindow {
    const settings = new XpSettingsWindow(options);
    settings.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(settings.view);
    return settings;
  }

  protected openLatencyTestWindow(options: LatencyTestWindowOptions): XpLatencyTestWindow {
    const test = new XpLatencyTestWindow(options);
    test.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(test.view);
    return test;
  }

  protected override closeMenus(): boolean {
    if (!this.startMenu) return false;
    this.startMenu.destroy();
    this.startMenu = null;
    this.menuLayer.hitArea = null;
    this.taskbar.startButton.setPressed(false);
    return true;
  }

  /** Only on the level list; during a round the Start menu belongs to the start-menu action */
  private openStartMenu(): void {
    if (this.startMenu || !this.desktopIdle) return;
    const menu = new XpStartMenu({
      onSelect: (label) => {
        this.playNow(this.sounds.menuCommand);
        this.closeMenus();
        if (label === CONTROL_PANEL) this.openSettings();
        else if (label === LOG_OFF || label === TURN_OFF_COMPUTER) this.leaveComputer();
      },
    });
    menu.view.position.set(0, WORK_AREA_HEIGHT - menu.height);
    // Clicks on the menu's own face (user bar, gaps) keep it open
    menu.view.eventMode = 'static';
    menu.view.hitArea = new Rectangle(0, 0, menu.width, menu.height);
    this.menuLayer.hitArea = new Rectangle(0, 0, XP_SCREEN_WIDTH, XP_SCREEN_HEIGHT);
    this.menuLayer.addChild(menu.view);
    this.taskbar.startButton.setPressed(true);
    this.startMenu = menu;
  }

  /** Error box in the middle of the screen; its button hovers orange and darkens when pressed, like the original */
  private showNoCharts(): void {
    const dialog = new XpMessageBox({
      kind: 'dialog-error',
      title: 'No Charts Available',
      text: 'The charts could not be loaded. See the browser console for details.\nChart files go in the public/charts/ folder.',
      buttons: ['OK'],
      maxTextWidth: 320,
    });
    const button = dialog.buttons[0]!;
    button.view.eventMode = 'static';
    button.view.on('pointerover', () => button.setHot(true));
    button.view.on('pointerout', () => {
      button.setHot(false);
      button.setPressed(false);
    });
    button.view.on('pointerdown', () => button.setPressed(true));
    button.view.on('pointertap', () => this.closeModal());
    dialog.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(dialog.view);
    this.showModal(dialog);
  }

  /** A message box for dialog actions; other actions have none */
  private createPopup(session: XpSession, target: XpTarget, event: number): XpMessageBox | null {
    const { phrase, index, action } = target.call;
    if (!isDialogKind(action)) return null;
    const texts = POPUP_TEXTS[action];
    const text = texts[(phrase * 3 + index) % texts.length]!;
    const popup = new XpMessageBox({ kind: action, ...text, maxTextWidth: POPUP_TEXT_WIDTH });
    // Shares screen slots with program windows, by its order among both in the phrase
    const slot = SLOTS[windowSlotIndex(session, event) % SLOTS.length]!;
    popup.view.position.set(slot.x, slot.y);
    popup.view.visible = false;
    this.windowLayer.addChild(popup.view);
    return popup;
  }

  private renderPopups(session: XpSession, beat: number, focus: number): void {
    session.targets.forEach((target, i) => {
      const popup = this.popups[i];
      if (!popup) return;
      const view = popup.view;
      const appearBeat = target.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let scale = 1;
      let alpha = 1;
      let active = i === focus;

      if (visible && target.handledAt !== null) {
        // Closed: the default button is pressed, then it shrinks and fades from the moment of input
        popup.buttons[0]!.setPressed(true);
        const p = (beat - session.beatAt(target.handledAt)) / BEATS.windowClose;
        visible = p < 1;
        scale = 1 - 0.2 * clamp01(p);
        alpha = 1 - clamp01(p);
      } else if (visible && target.missedAt !== null) {
        // Miss: the title bar flashes, and the box stays until the phrase ends
        const sinceMiss = beat - session.beatAt(target.missedAt);
        if (sinceMiss < FLASH_BEATS) active = Math.floor(sinceMiss / FLASH_STEP_BEATS) % 2 === 0;
        const phraseEnd = session.chart.phrases[target.call.phrase]!.end;
        const p = (beat - phraseEnd) / FADE_BEATS;
        visible = p < 1;
        alpha = 1 - clamp01(p);
      } else if (visible) {
        // Pops up to full size exactly on the call beat
        scale = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
      }

      view.visible = visible;
      if (!visible) return;
      view.scale.set(Math.max(0.01, scale));
      view.alpha = alpha;
      popup.setActive(active);
    });
  }

  /** Where the virtual mouse presses for each step (virtual screen); desktop-refresh is handled by VirtualMouse */
  private clickPoints(target: XpTarget, event: number, turn: Turn): { x: number; y: number }[] {
    if (target.call.action === 'chair-swivel') return [CHAIR_SPOT, CHAIR_SPOT];
    const popup = this.popups[event];
    if (popup) {
      const button = popup.buttonCenter();
      return [{ x: popup.view.x + button.x, y: popup.view.y + button.y }];
    }
    const points =
      this.waitHoldView!.clickPoints(event, turn) ?? this.shellView!.clickPoints(event);
    if (!points) throw new Error(`No click points for ${target.call.action}`);
    return points;
  }

  /**
   * The active window: in the call bar the newest box; in the gap and response bar the next one to close.
   * The rest get inactive title bars so the player can read the next target.
   */
  private focusedWindow(session: XpSession, beat: number): number {
    const phraseIndex = session.chart.phrases.findIndex((p) => beat >= p.callStart && beat < p.end);
    if (phraseIndex < 0) return -1;
    const phrase = session.chart.phrases[phraseIndex]!;
    const inPhrase = session.targets
      .map((target, i) => ({ target, i }))
      .filter(({ target }) => target.call.phrase === phraseIndex);

    if (beat < phrase.callEnd) {
      return inPhrase.filter(({ target }) => target.call.beat <= beat).at(-1)?.i ?? -1;
    }
    return (
      inPhrase.find(({ target }) => target.handledAt === null && target.missedAt === null)?.i ?? -1
    );
  }

  private renderJudgements(session: XpSession, beat: number): void {
    // New judgements appear above their target, converted to canvas coordinates
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const target = session.targets[record.event]!;
      const popup = this.popups[record.event];
      const anchor =
        this.shellView!.judgementAnchor(record.event) ??
        this.waitHoldView!.judgementAnchor(record.event);
      if (popup) {
        const slot = SLOTS[windowSlotIndex(session, record.event) % SLOTS.length]!;
        view.position.set(slot.x * XP_SCALE, (slot.y - popup.height / 2) * XP_SCALE - 20);
      } else if (anchor) {
        view.position.set(anchor.x * XP_SCALE, anchor.y * XP_SCALE - 20);
      } else if (target.call.action === 'chair-swivel') {
        view.position.set(CHAIR_SPOT.x * XP_SCALE, CHAIR_SPOT.y * XP_SCALE - 40);
      } else {
        // desktop-refresh: above the right-click spot
        const spot = VirtualMouse.refreshSpot(target);
        view.position.set(spot.x * XP_SCALE, spot.y * XP_SCALE - 40);
      }
      this.judgementLayer.addChild(view);
      this.judgementViews.push({ record, view });
    }

    // Squash and spring back, hold, fade out
    this.judgementViews = this.judgementViews.filter(({ record, view }) => {
      const since = beat - session.beatAt(record.shownAt);
      if (since >= BEATS.judgementHold + FADE_BEATS) {
        view.destroy({ children: true });
        return false;
      }
      const squash = 1 - clamp01(since / BEATS.squash);
      view.scale.set(1 + 0.25 * squash, 1 - 0.25 * squash);
      view.alpha = 1 - clamp01((since - BEATS.judgementHold) / FADE_BEATS);
      return true;
    });
  }
}

export const windowsXpScene: SceneEntry = {
  id: 'windows-xp',
  label: SCENE_CATALOG['windows-xp'].label,
  preload: async (audio) => {
    await preloadXpAssets(audio);
  },
  cursor: XP_CURSOR,
  create: (context) => new WindowsXpScene(context),
};
