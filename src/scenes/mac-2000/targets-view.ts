// Targets in a round: alerts, document windows, Dock bounces, Mail's badge, the Apple menu, files for the Trash,
// and judgement labels. Everything is computed from the current beat (doc/scenes/mac-2000.md "Gameplay").

import { Container } from 'pixi.js';
import { BEATS } from '@/theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '@/ui/easing.ts';
import { createJudgementView } from '@/ui/judgement-view.ts';
import type { MacAction } from './action-kinds.ts';
import { appIcon, type AppIconName } from './assets.ts';
import { AquaAlert } from './components/alert.ts';
import type { Dock } from './components/dock.ts';
import { createDesktopFile, FILE_ICON_SIZE } from './components/desktop-file.ts';
import { drawCautionIcon, drawFinderIcon } from './components/icons.ts';
import { APPLE_MENU, AquaMenu } from './components/menu.ts';
import { APPLE_MENU_LEFT, MENU_BAR_HEIGHT, type MenuBar } from './components/menu-bar.ts';
import { aquaText } from './components/paint.ts';
import { AquaWindow } from './components/window.ts';
import { MacExtrasView } from './extras-view.ts';
import type { JudgementRecord } from '@/scenes/shared/round-session.ts';
import type { MacSession, MacTarget } from './session.ts';

/** Alert and document window centres (virtual screen), used in order of their index in the phrase */
export const SLOTS = [
  { x: 190, y: 150 },
  { x: 512, y: 138 },
  { x: 834, y: 158 },
  { x: 236, y: 345 },
  { x: 560, y: 325 },
  { x: 846, y: 362 },
];

/** Dock places of the programs that bounce, used in order of their index in the phrase */
export const BOUNCE_DOCK_INDICES = [2, 3, 4, 5, 6, 7, 8, 9];
/** Mail's place in the Dock */
export const MAIL_DOCK_INDEX = 1;

type Point = { x: number; y: number };

const ALERT_WIDTH = 300;
const DOC_WIDTH = 240;
const DOC_HEIGHT = 150;

/** Bounce heights: the first jump, the small waiting hops, and Mail's light hop for new mail (screen px) */
const BOUNCE_HEIGHT = 26;
const WAIT_HOP_HEIGHT = 10;
const MAIL_HOP_HEIGHT = 12;
/** How long a clicked icon takes to settle back into the Dock (beats) */
const SETTLE_BEATS = 0.125;
/** Shake after a Miss (beats) */
const SHAKE_BEATS = 0.25;
/** Fade-out of alerts and judgement labels (beats) */
const FADE_BEATS = 0.25;
/** Minimising into the Dock (beats) */
const MINIMIZE_BEATS = 0.5;
/** A file's flight into the Trash (beats) and its drop height (px) */
const THROW_BEATS = 0.25;
const DROP_PIXELS = 24;
/** Apple menu: how long before the second press the item lights up, and the blink before closing after the pick (beats) */
const MENU_HOVER_BEATS = 0.2;
const MENU_BLINK_BEATS = 1 / 16;
const MENU_CLOSE_BEATS = 1 / 8;

/** Apple menu items picked, in rotation (visual only; nothing opens) */
const MENU_PICKS = [
  'About This Mac',
  'System Preferences…',
  'Force Quit…',
  'Get Mac OS X Software…',
];

/** Files for the Trash: documents (with a small application icon) or folders */
const FILES: { label: string; app: AppIconName | 'folder' }[] = [
  { label: 'Untitled.rtf', app: 'TextEdit' },
  { label: 'Mix Tape.mp3', app: 'iTunes' },
  { label: 'Holiday.jpg', app: 'Preview' },
  { label: 'Old Stuff', app: 'folder' },
  { label: 'Homework.txt', app: 'TextEdit' },
  { label: 'Screen Shot.pdf', app: 'Preview' },
];
/** The file row above the Dock, left to right; y is the icon centre (virtual screen) */
const FILE_ROW_LEFT = 120;
const FILE_ROW_STEP = 92;
const FILE_ROW_Y = 466;
/** chair-swivel: the virtual mouse clicks empty desktop here, and its judgement shows above (provisional) */
const CHAIR_SPOT: Point = { x: 512, y: 270 };

type AlertAction = Extract<MacAction, `alert-${string}`>;

/** Alert texts in the voice of period Mac OS X notices, all original */
const ALERT_TEXTS: Record<
  AlertAction,
  { app: AppIconName | 'finder'; message: string; informative: string }[]
> = {
  'alert-note': [
    {
      app: 'System Preferences',
      message: 'New software is available.',
      informative: 'Software Update found 3 updates for your computer.',
    },
    {
      app: 'Safari',
      message: 'Download complete.',
      informative: '“iTunes.dmg” was saved to your desktop.',
    },
    {
      app: 'iChat',
      message: 'You have a chat invitation.',
      informative: '“jenny2002” would like to chat with you.',
    },
  ],
  'alert-caution': [
    {
      app: 'finder',
      message: 'Are you sure you want to empty the Trash?',
      informative: 'The Trash contains 12 items. You cannot undo this action.',
    },
    {
      app: 'System Preferences',
      message: 'Your battery is running low.',
      informative: 'Plug in your power adapter, or your computer will go to sleep soon.',
    },
    {
      app: 'finder',
      message: 'The disk “Macintosh HD” is almost full.',
      informative: 'Delete some files to free up disk space.',
    },
  ],
  'alert-stop': [
    {
      app: 'iTunes',
      message: 'The application iTunes has unexpectedly quit.',
      informative: 'The system and other applications have not been affected.',
    },
    {
      app: 'Mail',
      message: 'Can’t connect to the mail server.',
      informative: 'Check your network settings, then try again.',
    },
    {
      app: 'TextEdit',
      message: 'The document “Homework.rtf” could not be found.',
      informative: 'The original file may have been moved or deleted.',
    },
  ],
};

/** Document windows: title and text, all original */
const DOCUMENTS = [
  { title: 'Untitled', text: 'Dear Sam,\nThe weather is great today.\nLet’s go to the park!' },
  {
    title: 'Read Me.rtf',
    text: 'Thanks for choosing this software.\nPlease read this before installing.',
  },
  { title: 'Shopping List.txt', text: 'Milk\nEggs\nZip disks ×2' },
  { title: 'Diary.rtf', text: 'August 24, 2002\nUpgraded to Jaguar today!' },
  { title: 'Homework.rtf', text: 'Chapter 3 Exercises\n1. Explain why…' },
  { title: 'Mix CD.txt', text: '1. Complicated\n2. In the End\n3. …' },
];

interface WindowLike {
  view: Container;
  setActive(active: boolean): void;
  destroy(): void;
}

interface ScreenTarget {
  target: MacTarget;
  index: number;
  window: WindowLike;
  alert: AquaAlert | null;
}

interface FileTarget {
  target: MacTarget;
  view: Container;
  /** Icon centre */
  center: Point;
}

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

export interface TargetsViewOptions {
  /** Layer for alerts and windows (virtual screen) */
  windowLayer: Container;
  /** Layer for judgement labels (canvas) */
  judgementLayer: Container;
  dock: Dock;
  menuBar: MenuBar;
  /** Layer for files, above the Dock so it doesn't hide them flying into the Trash */
  fileLayer: Container;
  /** Layer for the Apple menu, above the menu bar and below the virtual mouse */
  menuLayer: Container;
  /** Scale from the virtual screen to the canvas */
  screenScale: number;
}

export class MacTargetsView {
  private readonly session: MacSession;
  private readonly options: TargetsViewOptions;
  private readonly screenTargets: ScreenTarget[] = [];
  private readonly files: FileTarget[] = [];
  private readonly menu = new AquaMenu({ entries: APPLE_MENU });
  private readonly menuOrigin: Point = { x: APPLE_MENU_LEFT, y: MENU_BAR_HEIGHT };
  /** Save sheets, iChat messages and the menu bar volume */
  private readonly extras: MacExtrasView;
  private judgementViews: ActiveJudgement[] = [];
  private shownJudgements = 0;

  constructor(session: MacSession, options: TargetsViewOptions) {
    this.session = session;
    this.options = options;
    session.targets.forEach((target, index) => {
      if (target.kind === 'alert' || target.kind === 'window') {
        const created = createScreenTarget(target);
        created.window.view.visible = false;
        options.windowLayer.addChild(created.window.view);
        this.screenTargets.push({ target, index, ...created });
      } else if (target.kind === 'file') {
        const file = FILES[(target.call.phrase * 2 + target.order) % FILES.length]!;
        const view = createDesktopFile(file.label, file.app);
        view.visible = false;
        options.fileLayer.addChild(view);
        const center = { x: FILE_ROW_LEFT + target.order * FILE_ROW_STEP, y: FILE_ROW_Y };
        this.files.push({ target, view, center });
      }
    });
    this.menu.view.position.set(this.menuOrigin.x, this.menuOrigin.y);
    this.menu.view.visible = false;
    options.menuLayer.addChild(this.menu.view);
    this.extras = new MacExtrasView(session, { ...options, slots: SLOTS });
  }

  /** Slider drag progress of a hold (menu-volume), followed by the virtual mouse; null when not dragging */
  dragProgress(event: number, beat: number): number | null {
    const target = this.session.targets[event]!;
    return target.kind === 'volume' ? this.extras.dragProgress(target, beat) : null;
  }

  /** Where the virtual mouse presses for each step (virtual screen) */
  clickPoints(event: number): Point[] {
    const target = this.session.targets[event]!;
    const { dock, menuBar } = this.options;
    switch (target.kind) {
      case 'alert':
      case 'window': {
        const screen = this.screenTargets.find((t) => t.index === event)!;
        const slot = SLOTS[target.order % SLOTS.length]!;
        const offset = screen.alert
          ? screen.alert.defaultButtonCenter
          : (screen.window as AquaWindow).minimizeCenter;
        return [add(slot, offset)];
      }
      case 'dock':
      case 'mail':
        return [add(dock.view.position, dock.iconCenter(this.dockIndex(target)))];
      case 'menu': {
        const item = this.menu.itemCenter(this.menuPick(target));
        return [add(menuBar.view.position, menuBar.appleCenter), add(this.menuOrigin, item)];
      }
      case 'file':
        return [this.files.find((f) => f.target === target)!.center];
      case 'sheet':
      case 'chat':
      case 'volume':
        return this.extras.clickPoints(event);
      case 'chair':
        return [CHAIR_SPOT, CHAIR_SPOT];
    }
  }

  update(audioTime: number): void {
    const beat = this.session.beatAt(audioTime);
    const focus = this.focusedTarget(beat);
    this.renderScreenTargets(beat, focus, audioTime);
    this.renderDock(beat);
    this.renderMenu(beat);
    this.renderFiles(beat);
    this.extras.update(beat, audioTime, focus);
    this.renderJudgements(beat);
  }

  destroy(): void {
    for (const { window } of this.screenTargets) window.destroy();
    for (const { view } of this.files) view.destroy({ children: true });
    this.extras.destroy();
    this.menu.destroy();
    this.options.menuBar.setAppleHighlighted(false);
    this.options.dock.setTrashFull(false);
    for (const { view } of this.judgementViews) view.destroy({ children: true });
    const { dock } = this.options;
    for (const index of [...BOUNCE_DOCK_INDICES, MAIL_DOCK_INDEX]) dock.setLift(index, 0);
    for (const index of BOUNCE_DOCK_INDICES) dock.setRunning(index, false);
    dock.setBadge(MAIL_DOCK_INDEX, 0);
  }

  /**
   * The next target: in the call bar the newest; in the gap and response bar the next to handle.
   * Alerts and windows show it as active and the rest inactive, so the player can read what comes next.
   */
  private focusedTarget(beat: number): number {
    const { chart, targets } = this.session;
    const phraseIndex = chart.phrases.findIndex((p) => beat >= p.callStart && beat < p.end);
    if (phraseIndex < 0) return -1;
    const phrase = chart.phrases[phraseIndex]!;
    const inPhrase = targets
      .map((target, i) => ({ target, i }))
      .filter(({ target }) => target.call.phrase === phraseIndex);
    if (beat < phrase.callEnd) {
      return inPhrase.filter(({ target }) => target.call.beat <= beat).at(-1)?.i ?? -1;
    }
    return (
      inPhrase.find(({ target }) => target.handledAt === null && target.missedAt === null)?.i ?? -1
    );
  }

  private phraseEnd(target: MacTarget): number {
    return this.session.chart.phrases[target.call.phrase]!.end;
  }

  private renderScreenTargets(beat: number, focus: number, audioTime: number): void {
    const { session } = this;
    for (const { target, index, window, alert } of this.screenTargets) {
      const view = window.view;
      const slot = SLOTS[target.order % SLOTS.length]!;
      const appearBeat = target.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let x = slot.x;
      let y = slot.y;
      let scale = 1;
      let alpha = 1;

      if (visible && target.handledAt !== null) {
        const since = beat - session.beatAt(target.handledAt);
        if (target.kind === 'window') {
          // Minimise (the original genie/scale effect): shrink while flying into the Dock
          const p = clamp01(since / MINIMIZE_BEATS);
          const eased = p * p;
          const to = this.minimizeTarget();
          x = slot.x + (to.x - slot.x) * eased;
          y = slot.y + (to.y - slot.y) * eased;
          scale = 1 - 0.92 * easeOutCubic(p);
          visible = p < 1;
        } else {
          // OK clicked: the alert shrinks and fades
          const p = since / BEATS.windowClose;
          visible = p < 1;
          scale = 1 - 0.2 * clamp01(p);
          alpha = 1 - clamp01(p);
        }
      } else if (visible && target.missedAt !== null) {
        // Miss: a sideways shake, then it stays until the phrase ends and fades
        const since = beat - session.beatAt(target.missedAt);
        if (since < SHAKE_BEATS) {
          x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
        }
        const p = (beat - this.phraseEnd(target)) / FADE_BEATS;
        visible = p < 1;
        alpha = 1 - clamp01(p);
      } else if (visible) {
        // Pops up to full size exactly on the call beat
        scale = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
      }

      view.visible = visible;
      if (!visible) continue;
      view.position.set(x, y);
      view.scale.set(Math.max(0.01, scale));
      view.alpha = alpha;
      window.setActive(index === focus);
      alert?.update(audioTime);
    }
  }

  /** Where a minimised window flies (virtual screen) */
  private minimizeTarget(): { x: number; y: number } {
    const { dock } = this.options;
    const to = dock.minimizeTarget();
    return { x: dock.view.x + to.x, y: dock.view.y + to.y };
  }

  private renderDock(beat: number): void {
    const { dock } = this.options;
    const { session } = this;
    const lifts = new Map<number, { lift: number; squash: number }>();
    const raise = (index: number, lift: number, squash: number) => {
      const current = lifts.get(index) ?? { lift: 0, squash: 0 };
      lifts.set(index, {
        lift: Math.max(current.lift, lift),
        squash: Math.max(current.squash, squash),
      });
    };
    const running = new Set<number>();
    let unread = 0;
    let badgePop = 0;

    for (const target of session.targets) {
      const end = this.phraseEnd(target);
      const callBeat = target.call.beat;
      const handledBeat = target.handledAt === null ? null : session.beatAt(target.handledAt);

      if (target.kind === 'dock') {
        const index = BOUNCE_DOCK_INDICES[target.order % BOUNCE_DOCK_INDICES.length]!;
        if (beat < callBeat - 1 || beat >= end) continue;
        if (handledBeat !== null && beat >= handledBeat) {
          // Clicked: settles back into the Dock with the running triangle below
          const p = clamp01((beat - handledBeat) / SETTLE_BEATS);
          raise(index, bounceLift(handledBeat, callBeat) * (1 - p), 0);
          running.add(index);
        } else {
          const squash = beat >= callBeat ? 1 - clamp01((beat - callBeat) / BEATS.squash) : 0;
          raise(index, bounceLift(beat, callBeat), squash);
        }
      } else if (target.kind === 'mail') {
        // New mail: Mail hops lightly before the beat and the badge goes up by one as it lands
        const hop = (beat - (callBeat - 0.5)) / 0.5;
        if (hop >= 0 && hop < 1) raise(MAIL_DOCK_INDEX, MAIL_HOP_HEIGHT * 4 * hop * (1 - hop), 0);
        const arrived = beat >= callBeat;
        const read = handledBeat !== null && beat >= handledBeat;
        const dropped = target.missedAt !== null && beat >= end;
        if (arrived && !read && !dropped) unread++;
        for (const changed of [callBeat, handledBeat]) {
          if (changed === null || beat < changed) continue;
          badgePop = Math.max(badgePop, 1 - clamp01((beat - changed) / BEATS.squash));
        }
      }
    }

    for (const index of [...BOUNCE_DOCK_INDICES, MAIL_DOCK_INDEX]) {
      const { lift, squash } = lifts.get(index) ?? { lift: 0, squash: 0 };
      dock.setLift(index, lift, squash);
    }
    for (const index of BOUNCE_DOCK_INDICES) dock.setRunning(index, running.has(index));
    dock.setBadge(MAIL_DOCK_INDEX, unread, unread > 0 ? badgePop : 0);
  }

  /** Which Dock icon a dock-bounce or new mail uses */
  private dockIndex(target: MacTarget): number {
    return target.kind === 'mail'
      ? MAIL_DOCK_INDEX
      : BOUNCE_DOCK_INDICES[target.order % BOUNCE_DOCK_INDICES.length]!;
  }

  /** The menu item this menu-apple picks */
  private menuPick(target: MacTarget): string {
    return MENU_PICKS[(target.call.phrase + target.order) % MENU_PICKS.length]!;
  }

  /** Apple menu, at most one at a time; the Apple's title turns blue while it is open */
  private renderMenu(beat: number): void {
    let open = false;
    let hot: string | null = null;
    for (const target of this.session.targets) {
      if (target.kind !== 'menu') continue;
      const state = this.menuState(target, beat);
      if (!state.open) continue;
      open = true;
      hot = state.hot ? this.menuPick(target) : null;
    }
    this.menu.view.visible = open;
    this.menu.setHot(open ? hot : null);
    this.options.menuBar.setAppleHighlighted(open);
  }

  /**
   * Apple menu state. Call: the first press opens it, the second picks, the item blinks and the menu closes.
   * Response: it opens only when the first press hits; a hit second press blinks and closes, a Miss leaves it open to the phrase end.
   */
  private menuState(target: MacTarget, beat: number): { open: boolean; hot: boolean } {
    const { session } = this;
    const phrase = session.chart.phrases[target.call.phrase]!;
    const closed = { open: false, hot: false };
    const [first, second] = target.clicks;
    if (!first || !second) return closed;
    const gap = second.beat - first.beat;
    /** After the pick: off, on again, then closed */
    const chosen = (pick: number) => {
      const since = beat - pick;
      if (since >= MENU_CLOSE_BEATS) return closed;
      return { open: true, hot: since >= MENU_BLINK_BEATS };
    };

    if (beat < phrase.callEnd) {
      const openBeat = target.call.beat;
      const pickBeat = openBeat + gap;
      if (beat < openBeat) return closed;
      if (beat >= pickBeat) return chosen(pickBeat);
      return { open: true, hot: beat >= pickBeat - MENU_HOVER_BEATS };
    }
    if (first.hitAt === null || beat < session.beatAt(first.hitAt)) return closed;
    if (second.hitAt !== null && beat >= session.beatAt(second.hitAt)) {
      return chosen(session.beatAt(second.hitAt));
    }
    if (beat >= phrase.end) return closed;
    return { open: true, hot: beat >= second.beat - MENU_HOVER_BEATS };
  }

  /** Files for the Trash; the Trash shows full once a file in this phrase is thrown in */
  private renderFiles(beat: number): void {
    const { session } = this;
    const { dock } = this.options;
    const currentPhrase = session.chart.phrases.findIndex(
      (p) => beat >= p.callStart && beat < p.end,
    );
    const trash = add(dock.view.position, dock.trashCenter());
    let full = false;

    for (const { target, view, center } of this.files) {
      const appearBeat = target.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let { x, y } = center;
      let scale = 1;
      let alpha = 1;
      if (visible && target.handledAt !== null) {
        // Arcs into the Trash, shrinking as it goes
        const p = clamp01((beat - session.beatAt(target.handledAt)) / THROW_BEATS);
        x = center.x + (trash.x - center.x) * p;
        y = center.y + (trash.y - center.y) * p - 60 * Math.sin(Math.PI * p);
        scale = 1 - 0.6 * p;
        visible = p < 1;
        if (p >= 1 && target.call.phrase === currentPhrase) full = true;
      } else if (visible && target.missedAt !== null) {
        // Miss: a sideways shake, then it stays until the phrase ends and fades
        const since = beat - session.beatAt(target.missedAt);
        if (since < SHAKE_BEATS) {
          x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
        }
        alpha = 1 - clamp01((beat - this.phraseEnd(target)) / FADE_BEATS);
        visible = alpha > 0;
      } else if (visible) {
        // Drops from above, landing with a small bounce on the call beat
        const p = (beat - appearBeat) / BEATS.windowOpen;
        y -= DROP_PIXELS * (1 - easeOutBack(p));
        alpha = clamp01(p * 2);
      }
      view.visible = visible;
      if (!visible) continue;
      view.position.set(x, y);
      view.scale.set(scale);
      view.alpha = alpha;
    }
    dock.setTrashFull(full);
  }

  private renderJudgements(beat: number): void {
    const { session } = this;
    const { judgementLayer, screenScale } = this.options;
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const at = this.judgementAnchor(session.targets[record.event]!);
      view.position.set(at.x * screenScale, at.y * screenScale - 20);
      judgementLayer.addChild(view);
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

  /** Judgement labels go above their target (virtual screen) */
  private judgementAnchor(target: MacTarget): { x: number; y: number } {
    const { dock } = this.options;
    if (target.kind === 'dock' || target.kind === 'mail') {
      const center = dock.iconCenter(this.dockIndex(target));
      return { x: dock.view.x + center.x, y: dock.view.y - BOUNCE_HEIGHT };
    }
    if (target.kind === 'menu') {
      // Right of the menu, below the menu bar
      return { x: this.menuOrigin.x + this.menu.width + 60, y: this.menuOrigin.y + 50 };
    }
    if (target.kind === 'chair') return { x: CHAIR_SPOT.x, y: CHAIR_SPOT.y - 30 };
    if (target.kind === 'file') {
      const file = this.files.find((f) => f.target === target)!;
      return { x: file.center.x, y: file.center.y - FILE_ICON_SIZE / 2 - 4 };
    }
    if (this.extras.handles(target)) return this.extras.judgementAnchor(target);
    const slot = SLOTS[target.order % SLOTS.length]!;
    const alert = this.screenTargets.find((t) => t.target === target)?.alert;
    const height = alert ? alert.height : DOC_HEIGHT;
    return { x: slot.x, y: slot.y - height / 2 };
  }
}

/**
 * Dock bounce height: takes off 1 beat before the beat and lands on it (the first jump), then hops every beat until clicked.
 */
function bounceLift(beat: number, callBeat: number): number {
  if (beat < callBeat) {
    const u = clamp01(beat - (callBeat - 1));
    return BOUNCE_HEIGHT * 4 * u * (1 - u);
  }
  const u = (beat - callBeat) % 1;
  return WAIT_HOP_HEIGHT * 4 * u * (1 - u);
}

function alertIcon(action: AlertAction, app: AppIconName | 'finder'): Container {
  const icon = new Container({ label: 'alert-icon' });
  const appGraphic = (size: number) =>
    app === 'finder' ? drawFinderIcon(size) : appIcon(app, size);
  if (action === 'alert-caution') {
    // Caution alert: the yellow triangle with a small application badge at the bottom right
    const badge = appGraphic(32);
    badge.position.set(32, 32);
    icon.addChild(drawCautionIcon(64), badge);
  } else {
    icon.addChild(appGraphic(64));
  }
  return icon;
}

function createScreenTarget(target: MacTarget): { window: WindowLike; alert: AquaAlert | null } {
  const variant = target.call.phrase * 3 + target.order;
  if (target.kind === 'alert') {
    const action = target.action as AlertAction;
    const texts = ALERT_TEXTS[action];
    const { app, message, informative } = texts[variant % texts.length]!;
    const alert = new AquaAlert({
      icon: alertIcon(action, app),
      message,
      informative,
      buttons: [{ label: 'OK', isDefault: true }],
      width: ALERT_WIDTH,
    });
    return { window: alert, alert };
  }

  const doc = DOCUMENTS[variant % DOCUMENTS.length]!;
  const window = new AquaWindow({
    title: doc.title,
    width: DOC_WIDTH,
    height: DOC_HEIGHT,
    content: 'white',
    toolbarButton: false,
    scroller: { thumbStart: 0, thumbSize: 1 },
  });
  const text = aquaText(doc.text, {
    size: 12,
    lineHeight: 16,
    wrapWidth: window.contentWidth - 16,
  });
  text.position.set(8, 6);
  window.content.addChild(text);
  return { window, alert: null };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
