// Tray balloons, program windows, the Start menu and Recycle Bin files in a round (doc/scenes/windows-xp-levels.md).
// Message boxes and desktop-refresh are drawn by the scene. Everything is computed from the beat;
// coordinates are virtual XP screen coordinates.

import { Container } from 'pixi.js';
import { BEATS } from '@/theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '@/ui/easing.ts';
import { XpBalloon } from './components/balloon.ts';
import {
  DESKTOP_CELL_HEIGHT,
  DESKTOP_CELL_WIDTH,
  DESKTOP_ICON_SIZE,
  desktopIcon,
  type XpDesktop,
} from './components/desktop.ts';
import { PROGRAM_KINDS, XpProgramWindow } from './components/program-window.ts';
import { TASKBAR_HEIGHT, WORK_AREA_HEIGHT } from './components/screen.ts';
import { XpStartMenu } from './components/start-menu.ts';
import {
  TASK_HEIGHT,
  TASK_LEFT,
  TASK_WIDTH,
  TaskButton,
  type XpTaskbar,
} from './components/taskbar.ts';
import type { XpSession, XpTarget } from './session.ts';
import { isShellAction, PHRASE_LIMITS } from './shell-actions.ts';

type Point = { x: number; y: number };

/** How long a program window takes to shrink into the taskbar, and a file to fly into the bin (beats) */
const MINIMIZE_BEATS = 0.25;
const THROW_BEATS = 0.25;
/** Shake after a Miss: duration (beats) and amplitude (px) */
const SHAKE_BEATS = 0.25;
const SHAKE_PIXELS = 4;
/** Fade-out (beats) */
const FADE_BEATS = 0.25;
/** Title bar flashing after a Miss, as for message boxes: step and duration (beats) */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
/** Start menu: the item lights up this long before the second press, and the menu closes this long after (beats) */
const MENU_HOVER_BEATS = 0.2;
const MENU_CLOSE_BEATS = 1 / 16;
/** How far files drop (px) */
const DROP_PIXELS = 24;
/** Vertical gap between balloons */
const BALLOON_GAP = 4;
const BALLOON_WIDTH = 230;
/** Spacing of the tray icons, as in taskbar.ts */
const TRAY_STEP = 16 + 6;
/** Spacing of the program buttons */
const TASK_GAP = 3;
/** Highest a program window's top may go (virtual screen): just below the turn banner */
const PROGRAM_TOP_MIN = 52;
/** Centre of the Start button */
const START_BUTTON_CENTER_X = 50;

/** Balloon texts in the voice of period system notices, all original */
const BALLOON_TEXTS = [
  { title: 'Found New Hardware', text: 'USB Mass Storage Device', icon: 'dialog-info' },
  { title: 'Windows Messenger', text: 'Jamie has just signed in.', icon: 'windows-messenger' },
  { title: 'Automatic Updates', text: 'New updates are ready to download.', icon: 'dialog-info' },
  { title: 'Local Area Connection', text: 'A network cable is unplugged.', icon: 'dialog-warning' },
  { title: 'Security Center', text: 'Your computer might be at risk.', icon: 'dialog-warning' },
];

/** Files to throw away */
const FILES = [
  { icon: 'text-document', label: 'New Text Document.txt' },
  { icon: 'music-file', label: 'Hey Ya!.mp3' },
  { icon: 'unknown-file', label: 'setup.exe' },
  { icon: 'paint', label: 'untitled.bmp' },
  { icon: 'folder', label: 'New Folder' },
  { icon: 'text-document', label: 'homework(1).doc' },
];

/** Programs picked from the Start menu, in rotation */
const MENU_ITEMS = [
  'Notepad',
  'Paint',
  'Minesweeper',
  'Calculator',
  'Windows Media Player',
  'Windows Messenger',
];

/** The file row, left to right, leaving a little room left of the Recycle Bin */
const FILE_ROW_LEFT = 120;
const FILE_ROW_STEP = 92;
const FILE_ROW_TOP = WORK_AREA_HEIGHT - DESKTOP_CELL_HEIGHT;

interface BalloonTarget {
  kind: 'balloon';
  event: number;
  view: XpBalloon;
  tip: Point;
}
interface ProgramTarget {
  kind: 'program';
  event: number;
  view: XpProgramWindow;
  slot: Point;
  task: TaskButton;
  /** Taskbar button centre, where the window pops out and shrinks back */
  taskCenter: Point;
}
interface FileTarget {
  kind: 'file';
  event: number;
  view: Container;
  /** Top left of the icon cell */
  cell: Point;
}
interface MenuTarget {
  kind: 'menu';
  event: number;
  item: string;
}
type Target = BalloonTarget | ProgramTarget | FileTarget | MenuTarget;

export interface ShellTargetsViewOptions {
  session: XpSession;
  desktop: XpDesktop;
  taskbar: XpTaskbar;
  /** Message boxes share this layer and the screen slots with program windows */
  windowLayer: Container;
  /** Screen slots (window centres) shared by message boxes and program windows, indexed by windowSlotIndex */
  slots: readonly Point[];
}

export class ShellTargetsView {
  /** Files on the desktop: above the wallpaper, below the windows */
  readonly desktopLayer = new Container({ label: 'shell-desktop' });
  /** Balloons, the Start menu and program buttons: above the taskbar */
  readonly overlayLayer = new Container({ label: 'shell-overlay' });
  private readonly session: XpSession;
  private readonly desktop: XpDesktop;
  private readonly taskbar: XpTaskbar;
  private readonly targets = new Map<number, Target>();
  private readonly menu = new XpStartMenu();
  private readonly menuOrigin: Point;
  private readonly taskbarTop: number;

  constructor({ session, desktop, taskbar, windowLayer, slots }: ShellTargetsViewOptions) {
    this.session = session;
    this.desktop = desktop;
    this.taskbar = taskbar;
    this.taskbarTop = WORK_AREA_HEIGHT;
    this.menuOrigin = { x: 0, y: this.taskbarTop - this.menu.height };
    this.menu.view.position.set(this.menuOrigin.x, this.menuOrigin.y);
    this.menu.view.visible = false;
    this.menu.view.eventMode = 'none';

    const tray = this.trayIcons();
    const taskScale = this.taskButtonScale();
    let balloonStack = 0;

    session.targets.forEach((state, event) => {
      const action = state.call.action;
      if (!isShellAction(action)) return;
      const order = orderInPhrase(session, event, (a) => a === action);
      const { phrase } = state.call;

      if (action === 'balloon-info') {
        if (order === 0) balloonStack = 0;
        const text = BALLOON_TEXTS[(phrase * 2 + order) % BALLOON_TEXTS.length]!;
        const view = new XpBalloon({ ...text, width: BALLOON_WIDTH });
        const icon = tray[order % tray.length]!;
        const tip = { x: icon.x, y: icon.y - balloonStack };
        balloonStack += view.height + BALLOON_GAP;
        view.view.position.set(tip.x, tip.y);
        view.view.visible = false;
        this.overlayLayer.addChild(view.view);
        this.targets.set(event, { kind: 'balloon', event, view, tip });
      } else if (action === 'window-minimize') {
        const program = PROGRAM_KINDS[(phrase + order) % PROGRAM_KINDS.length]!;
        const view = new XpProgramWindow(program);
        // Program windows are taller than message boxes; keep the title bar clear of the turn banner so the minimise button shows
        const shared = slots[windowSlotIndex(session, event) % slots.length]!;
        const slot = { x: shared.x, y: Math.max(shared.y, PROGRAM_TOP_MIN + view.height / 2) };
        const task = new TaskButton({ icon: view.spec.icon, label: view.spec.taskLabel });
        const taskLeft = TASK_LEFT + (1 + order) * (TASK_WIDTH + TASK_GAP) * taskScale;
        const taskTop = this.taskbarTop + (TASKBAR_HEIGHT - TASK_HEIGHT) / 2 + 1;
        task.view.position.set(taskLeft, taskTop);
        task.view.scale.x = taskScale;
        task.view.visible = false;
        view.view.visible = false;
        windowLayer.addChild(view.view);
        this.overlayLayer.addChild(task.view);
        const taskCenter = {
          x: taskLeft + (TASK_WIDTH * taskScale) / 2,
          y: taskTop + TASK_HEIGHT / 2,
        };
        this.targets.set(event, { kind: 'program', event, view, slot, task, taskCenter });
      } else if (action === 'recycle-bin') {
        const file = FILES[(phrase * 2 + order) % FILES.length]!;
        const cell = { x: FILE_ROW_LEFT + order * FILE_ROW_STEP, y: FILE_ROW_TOP };
        const view = desktopIcon(file.icon, file.label, 0, 0);
        view.pivot.set(DESKTOP_CELL_WIDTH / 2, DESKTOP_ICON_SIZE / 2);
        view.visible = false;
        this.desktopLayer.addChild(view);
        this.targets.set(event, { kind: 'file', event, view, cell });
      } else {
        const item = MENU_ITEMS[(phrase + order) % MENU_ITEMS.length]!;
        this.targets.set(event, { kind: 'menu', event, item });
      }
    });
    this.overlayLayer.addChild(this.menu.view);
  }

  /** Whether this view draws the chart event */
  handles(event: number): boolean {
    return this.targets.has(event);
  }

  /** Where the virtual mouse presses for each step; null for events drawn elsewhere */
  clickPoints(event: number): Point[] | null {
    const target = this.targets.get(event);
    if (!target) return null;
    switch (target.kind) {
      case 'balloon':
        return [add(target.tip, target.view.closeCenter)];
      case 'program':
        return [add(target.slot, target.view.minimizeCenter)];
      case 'file':
        return [this.fileCenter(target)];
      case 'menu': {
        const item = this.menu.itemCenter(target.item) ?? { x: 0, y: 0 };
        return [
          { x: START_BUTTON_CENTER_X, y: this.taskbarTop + TASKBAR_HEIGHT / 2 },
          add(this.menuOrigin, item),
        ];
      }
    }
  }

  /** Where the judgement label goes: the middle of the target's top edge */
  judgementAnchor(event: number): Point | null {
    const target = this.targets.get(event);
    if (!target) return null;
    switch (target.kind) {
      case 'balloon':
        return { x: target.tip.x - BALLOON_WIDTH / 2 + 30, y: target.tip.y - target.view.height };
      case 'program':
        return { x: target.slot.x, y: target.slot.y - target.view.height / 2 };
      case 'file':
        return { x: target.cell.x + DESKTOP_CELL_WIDTH / 2, y: target.cell.y - 4 };
      case 'menu':
        return { x: START_BUTTON_CENTER_X + 20, y: this.taskbarTop - 12 };
    }
  }

  /** focus: the active window (chart event index) from the scene; program windows colour their title bar by it */
  update(beat: number, focus: number): void {
    let menuOpen = false;
    let menuItem: string | null = null;
    let binFull = false;
    const currentPhrase = this.session.chart.phrases.findIndex(
      (p) => beat >= p.callStart && beat < p.end,
    );

    for (const target of this.targets.values()) {
      const state = this.session.targets[target.event]!;
      switch (target.kind) {
        case 'balloon':
          this.renderBalloon(target, state, beat);
          break;
        case 'program':
          this.renderProgram(target, state, beat, focus === target.event);
          break;
        case 'file':
          if (this.renderFile(target, state, beat) && state.call.phrase === currentPhrase) {
            binFull = true;
          }
          break;
        case 'menu': {
          const menu = this.menuState(state, beat);
          if (menu.open) {
            menuOpen = true;
            menuItem = menu.hover ? target.item : null;
          }
          break;
        }
      }
    }

    this.menu.view.visible = menuOpen;
    this.menu.highlight(menuOpen ? menuItem : null);
    this.taskbar.startButton.setPressed(menuOpen);
    this.desktop.setRecycleBinFull(binFull);
  }

  destroy(): void {
    for (const target of this.targets.values()) {
      if (target.kind === 'balloon' || target.kind === 'program') target.view.destroy();
    }
    this.taskbar.startButton.setPressed(false);
    this.desktop.setRecycleBinFull(false);
    this.desktopLayer.destroy({ children: true });
    this.overlayLayer.destroy({ children: true });
  }

  // ---------- Actions ----------

  private renderBalloon(target: BalloonTarget, state: XpTarget, beat: number): void {
    const view = target.view.view;
    const appearBeat = state.call.beat - BEATS.windowOpen;
    let visible = beat >= appearBeat;
    let scale = 1;
    let alpha = 1;
    let shake = 0;
    target.view.setCloseHot(false);
    if (visible && state.handledAt !== null) {
      target.view.setCloseHot(true);
      const p = (beat - this.session.beatAt(state.handledAt)) / BEATS.windowClose;
      visible = p < 1;
      scale = 1 - 0.3 * clamp01(p);
      alpha = 1 - clamp01(p);
    } else if (visible && state.missedAt !== null) {
      shake = this.shake(beat, state.missedAt);
      alpha = this.fadeAtPhraseEnd(state, beat);
      visible = alpha > 0;
    } else if (visible) {
      // Pops out from the tail, reaching full size exactly on the call beat
      scale = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
    }
    view.visible = visible;
    if (!visible) return;
    view.position.set(target.tip.x + shake, target.tip.y);
    view.scale.set(Math.max(0.01, scale));
    view.alpha = alpha;
  }

  private renderProgram(
    target: ProgramTarget,
    state: XpTarget,
    beat: number,
    focused: boolean,
  ): void {
    const view = target.view.view;
    const appearBeat = state.call.beat - BEATS.windowOpen;
    const phraseEnd = this.session.chart.phrases[state.call.phrase]!.end;
    const taskVisible = beat >= appearBeat && beat < phraseEnd + FADE_BEATS;
    target.task.view.visible = taskVisible;
    target.task.view.alpha = 1 - clamp01((beat - phraseEnd) / FADE_BEATS);

    let visible = beat >= appearBeat;
    let active = focused;
    let progress = 1;
    let alpha = 1;
    if (visible && state.handledAt !== null) {
      // Minimise: shrink towards its taskbar button, which pops up
      const p = (beat - this.session.beatAt(state.handledAt)) / MINIMIZE_BEATS;
      visible = p < 1;
      progress = 1 - easeOutCubic(p);
      alpha = 1 - 0.5 * clamp01(p);
      active = false;
    } else if (visible && state.missedAt !== null) {
      const sinceMiss = beat - this.session.beatAt(state.missedAt);
      if (sinceMiss < FLASH_BEATS) active = Math.floor(sinceMiss / FLASH_STEP_BEATS) % 2 === 0;
      alpha = this.fadeAtPhraseEnd(state, beat);
      visible = alpha > 0;
    } else if (visible) {
      // Restore: grow out of the taskbar button, in place on the call beat
      progress = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
    }
    target.task.setActive(visible && state.handledAt === null && active);

    view.visible = visible;
    if (!visible) return;
    const { slot, taskCenter } = target;
    view.position.set(
      taskCenter.x + (slot.x - taskCenter.x) * progress,
      taskCenter.y + (slot.y - taskCenter.y) * progress,
    );
    view.scale.set(Math.max(0.05, progress));
    view.alpha = alpha;
    target.view.setActive(active);
  }

  /** Draws a file; returns whether it is already in the bin */
  private renderFile(target: FileTarget, state: XpTarget, beat: number): boolean {
    const view = target.view;
    const appearBeat = state.call.beat - BEATS.windowOpen;
    const center = this.fileCenter(target);
    let visible = beat >= appearBeat;
    let x = center.x;
    let y = center.y;
    let scale = 1;
    let alpha = 1;
    let thrown = false;
    if (visible && state.handledAt !== null) {
      // Arcs into the bin, shrinking as it goes
      const p = clamp01((beat - this.session.beatAt(state.handledAt)) / THROW_BEATS);
      const bin = this.desktop.recycleBinCenter;
      x = center.x + (bin.x - center.x) * p;
      y = center.y + (bin.y - center.y) * p - 60 * Math.sin(Math.PI * p);
      scale = 1 - 0.6 * p;
      thrown = p >= 1;
      visible = !thrown;
    } else if (visible && state.missedAt !== null) {
      x += this.shake(beat, state.missedAt);
      alpha = this.fadeAtPhraseEnd(state, beat);
      visible = alpha > 0;
    } else if (visible) {
      // Drops from above, landing with a small bounce on the call beat
      const p = (beat - appearBeat) / BEATS.windowOpen;
      y -= DROP_PIXELS * (1 - easeOutBack(p));
      alpha = clamp01(p * 2);
    }
    view.visible = visible;
    if (visible) {
      view.position.set(x, y);
      view.scale.set(scale);
      view.alpha = alpha;
    }
    return thrown;
  }

  /**
   * Start menu state. Call: the first press opens it, the second closes it.
   * Response: it opens only when the first press hits; a hit second press closes it, a Miss leaves it open to the phrase end.
   */
  private menuState(state: XpTarget, beat: number): { open: boolean; hover: boolean } {
    const phrase = this.session.chart.phrases[state.call.phrase]!;
    const closed = { open: false, hover: false };
    if (beat < phrase.callEnd) {
      const [open, click] = [state.call.beat, state.call.beat + 0.5];
      if (beat < open || beat >= click + MENU_CLOSE_BEATS) return closed;
      return { open: true, hover: beat >= click - MENU_HOVER_BEATS };
    }
    const [first, second] = state.clicks;
    if (!first || !second || first.hitAt === null) return closed;
    if (beat < this.session.beatAt(first.hitAt)) return closed;
    if (second.hitAt !== null) {
      const closeBeat = this.session.beatAt(second.hitAt) + MENU_CLOSE_BEATS;
      return beat < closeBeat ? { open: true, hover: true } : closed;
    }
    const hover = beat >= second.beat - MENU_HOVER_BEATS;
    return beat < phrase.end ? { open: true, hover } : closed;
  }

  // ---------- Helpers ----------

  private fileCenter(target: FileTarget): Point {
    return {
      x: target.cell.x + DESKTOP_CELL_WIDTH / 2,
      y: target.cell.y + 2 + DESKTOP_ICON_SIZE / 2,
    };
  }

  /** Sideways shake after a Miss (px) */
  private shake(beat: number, missedAt: number): number {
    const since = beat - this.session.beatAt(missedAt);
    if (since >= SHAKE_BEATS) return 0;
    return Math.sin(since * Math.PI * 16) * SHAKE_PIXELS * (1 - since / SHAKE_BEATS);
  }

  /** Missed targets stay until the phrase ends, then fade over FADE_BEATS */
  private fadeAtPhraseEnd(state: XpTarget, beat: number): number {
    const phraseEnd = this.session.chart.phrases[state.call.phrase]!.end;
    return 1 - clamp01((beat - phraseEnd) / FADE_BEATS);
  }

  /** Middle of the top edge of the network, Messenger and volume tray icons (where balloon tails point) */
  private trayIcons(): Point[] {
    const speaker = this.taskbar.volumeIcon;
    const trayX = speaker.parent?.x ?? 0;
    const x = trayX + speaker.x + 8;
    const y = this.taskbarTop + speaker.y + 2;
    return [x - 2 * TRAY_STEP, x - TRAY_STEP, x].map((ix) => ({ x: ix, y }));
  }

  /** Narrows the buttons like the original when 1 + the program window limit won't fit at standard width */
  private taskButtonScale(): number {
    const trayLeft = this.taskbar.volumeIcon.parent?.x ?? Infinity;
    const count = 1 + PHRASE_LIMITS.programs;
    const available = trayLeft - TASK_LEFT - 4;
    return Math.min(1, available / (count * (TASK_WIDTH + TASK_GAP)));
  }
}

/**
 * Screen slot index of a message box or program window: its order among both kinds in the phrase.
 * The scene places message boxes by it too, so the two kinds never overlap.
 */
export function windowSlotIndex(session: XpSession, event: number): number {
  return orderInPhrase(
    session,
    event,
    (action) => action.startsWith('dialog-') || action === 'window-minimize',
  );
}

/** The event's order (from 0) among the phrase's events that pass `test` */
function orderInPhrase(
  session: XpSession,
  event: number,
  test: (action: string) => boolean,
): number {
  const phrase = session.targets[event]!.call.phrase;
  let order = 0;
  for (let i = 0; i < event; i++) {
    const call = session.targets[i]!.call;
    if (call.phrase === phrase && test(call.action)) order++;
  }
  return order;
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
