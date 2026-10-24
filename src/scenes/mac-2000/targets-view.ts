// 一局里各个目标的画面：提示框、文稿窗口、Dock 弹跳、Mail 未读角标、苹果菜单、扔进废纸篓的文件，以及判定字样。
// 每帧只根据当前拍位置计算，不累加帧间隔（doc/scenes/mac-2000.md「玩法」）。

import { Container } from 'pixi.js';
import { BEATS } from '../../theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '../../ui/easing.ts';
import { createJudgementView } from '../../ui/judgement-view.ts';
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
import type { JudgementRecord } from '../shared/round-session.ts';
import type { MacSession, MacTarget } from './session.ts';

/** 提示框和文稿窗口的中心位置（虚拟屏幕坐标），按乐句内序号依次使用 */
export const SLOTS = [
  { x: 190, y: 150 },
  { x: 512, y: 138 },
  { x: 834, y: 158 },
  { x: 236, y: 345 },
  { x: 560, y: 325 },
  { x: 846, y: 362 },
];

/** Dock 上用来弹跳的程序在 Dock 里的位置，按乐句内序号依次使用 */
export const BOUNCE_DOCK_INDICES = [2, 3, 4, 5, 6, 7, 8, 9];
/** Mail 在 Dock 里的位置 */
export const MAIL_DOCK_INDEX = 1;

type Point = { x: number; y: number };

const ALERT_WIDTH = 300;
const DOC_WIDTH = 240;
const DOC_HEIGHT = 150;

/** 弹跳：第一跳的高度、之后等待时小跳的高度、Mail 新邮件轻跳的高度（屏幕像素） */
const BOUNCE_HEIGHT = 26;
const WAIT_HOP_HEIGHT = 10;
const MAIL_HOP_HEIGHT = 12;
/** 被点中后落回 Dock 的时长（拍） */
const SETTLE_BEATS = 0.125;
/** Miss 后抖动的时长（拍） */
const SHAKE_BEATS = 0.25;
/** 消息框、判定字样淡出的时长（拍） */
const FADE_BEATS = 0.25;
/** 最小化缩进 Dock 的时长（拍） */
const MINIMIZE_BEATS = 0.5;
/** 文件飞进废纸篓的时长（拍）、落下的高度（像素） */
const THROW_BEATS = 0.25;
const DROP_PIXELS = 24;
/** 苹果菜单：第二下之前多久菜单项开始高亮（虚拟鼠标移上去了）；选中后菜单项闪一下再收起（拍） */
const MENU_HOVER_BEATS = 0.2;
const MENU_BLINK_BEATS = 1 / 16;
const MENU_CLOSE_BEATS = 1 / 8;

/** 苹果菜单里会被点到的条目，按顺序轮换（只是画面，不打开任何东西） */
const MENU_PICKS = [
  'About This Mac',
  'System Preferences…',
  'Force Quit…',
  'Get Mac OS X Software…',
];

/** 扔进废纸篓的文件：文稿（中间叠程序小图标）或文件夹。新增的玩家可见文字只用英文 */
const FILES: { label: string; app: AppIconName | 'folder' }[] = [
  { label: 'Untitled.rtf', app: 'TextEdit' },
  { label: 'Mix Tape.mp3', app: 'iTunes' },
  { label: 'Holiday.jpg', app: 'Preview' },
  { label: 'Old Stuff', app: 'folder' },
  { label: 'Homework.txt', app: 'TextEdit' },
  { label: 'Screen Shot.pdf', app: 'Preview' },
];
/** 文件那一行：Dock 上方，从左往右；纵坐标是图标中心（虚拟屏幕坐标） */
const FILE_ROW_LEFT = 120;
const FILE_ROW_STEP = 92;
const FILE_ROW_Y = 466;

type AlertAction = Extract<MacAction, `alert-${string}`>;

/** 提示框文案：模仿 Mac OS X 当年的系统提示，全部原创 */
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

/** 文稿窗口：标题和正文，全部原创 */
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
  /** 图标中心 */
  center: Point;
}

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

export interface TargetsViewOptions {
  /** 提示框、窗口所在的图层（虚拟屏幕坐标） */
  windowLayer: Container;
  /** 判定字样所在的图层（画布坐标） */
  judgementLayer: Container;
  dock: Dock;
  menuBar: MenuBar;
  /** 扔进废纸篓的文件所在的图层：在 Dock 之上，飞进废纸篓时不会被 Dock 挡住 */
  fileLayer: Container;
  /** 苹果菜单所在的图层：在菜单栏之上、虚拟鼠标之下 */
  menuLayer: Container;
  /** 虚拟屏幕放大到画布的倍数 */
  screenScale: number;
}

export class MacTargetsView {
  private readonly session: MacSession;
  private readonly options: TargetsViewOptions;
  private readonly screenTargets: ScreenTarget[] = [];
  private readonly files: FileTarget[] = [];
  private readonly menu = new AquaMenu({ entries: APPLE_MENU });
  private readonly menuOrigin: Point = { x: APPLE_MENU_LEFT, y: MENU_BAR_HEIGHT };
  /** 表单、iChat 消息窗、菜单栏音量 */
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

  /** 长按（menu-volume）拖动滑块的进度，虚拟鼠标按住时跟着走；不在拖时返回 null */
  dragProgress(event: number, beat: number): number | null {
    const target = this.session.targets[event]!;
    return target.kind === 'volume' ? this.extras.dragProgress(target, beat) : null;
  }

  /** 虚拟鼠标每一下要点的位置（虚拟屏幕坐标） */
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
        const item = this.menu.itemCenter(this.menuPick(target)) ?? { x: 0, y: 0 };
        return [add(menuBar.view.position, menuBar.appleCenter), add(this.menuOrigin, item)];
      }
      case 'file':
        return [this.files.find((f) => f.target === target)!.center];
      case 'sheet':
      case 'chat':
      case 'volume':
        return this.extras.clickPoints(event);
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
   * 下一个目标：示范小节里是最新出现的那个；空档和跟打小节里是下一个该处理的那个。
   * 它是提示框或窗口时显示为活动状态，其余显示为非活动，让玩家看懂下一个目标。
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
          // 最小化（原版的「缩放效果」）：缩小着飞进 Dock
          const p = clamp01(since / MINIMIZE_BEATS);
          const eased = p * p;
          const to = this.minimizeTarget();
          x = slot.x + (to.x - slot.x) * eased;
          y = slot.y + (to.y - slot.y) * eased;
          scale = 1 - 0.92 * easeOutCubic(p);
          visible = p < 1;
        } else {
          // 按下「OK」：提示框缩小淡出
          const p = since / BEATS.windowClose;
          visible = p < 1;
          scale = 1 - 0.2 * clamp01(p);
          alpha = 1 - clamp01(p);
        }
      } else if (visible && target.missedAt !== null) {
        // Miss：左右抖一下，留到这一乐句结束再淡出
        const since = beat - session.beatAt(target.missedAt);
        if (since < SHAKE_BEATS) {
          x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
        }
        const p = (beat - this.phraseEnd(target)) / FADE_BEATS;
        visible = p < 1;
        alpha = 1 - clamp01(p);
      } else if (visible) {
        // 弹出：在示范拍点那一刻刚好弹到最大
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

  /** 最小化的窗口飞去的位置（虚拟屏幕坐标） */
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
          // 被点中：落回 Dock，下面出现「正在运行」的小三角
          const p = clamp01((beat - handledBeat) / SETTLE_BEATS);
          raise(index, bounceLift(handledBeat, callBeat) * (1 - p), 0);
          running.add(index);
        } else {
          const squash = beat >= callBeat ? 1 - clamp01((beat - callBeat) / BEATS.squash) : 0;
          raise(index, bounceLift(beat, callBeat), squash);
        }
      } else if (target.kind === 'mail') {
        // 新邮件：Mail 图标在拍点前轻跳一下，落下时角标加 1
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

  /** Dock 弹跳、新邮件用的是 Dock 上的第几个图标 */
  private dockIndex(target: MacTarget): number {
    return target.kind === 'mail'
      ? MAIL_DOCK_INDEX
      : BOUNCE_DOCK_INDICES[target.order % BOUNCE_DOCK_INDICES.length]!;
  }

  /** 这个 menu-apple 要点的菜单项 */
  private menuPick(target: MacTarget): string {
    return MENU_PICKS[(target.call.phrase + target.order) % MENU_PICKS.length]!;
  }

  /** 苹果菜单：同一时间最多一个；打开时菜单栏上的苹果标题变蓝 */
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
   * 苹果菜单的状态。示范段：第一下打开，第二下选中，菜单项闪一下后收起。
   * 跟打段：命中第一下才打开；第二下命中就同样闪一下收起，Miss 就一直开到乐句结束。
   */
  private menuState(target: MacTarget, beat: number): { open: boolean; hot: boolean } {
    const { session } = this;
    const phrase = session.chart.phrases[target.call.phrase]!;
    const closed = { open: false, hot: false };
    const [first, second] = target.clicks;
    if (!first || !second) return closed;
    const gap = second.beat - first.beat;
    /** 选中那一下之后：先灭一下再亮，然后收起 */
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

  /** 扔进废纸篓的文件；这一乐句里有文件扔进去了，废纸篓就是满的 */
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
        // 沿弧线飞进废纸篓，越飞越小
        const p = clamp01((beat - session.beatAt(target.handledAt)) / THROW_BEATS);
        x = center.x + (trash.x - center.x) * p;
        y = center.y + (trash.y - center.y) * p - 60 * Math.sin(Math.PI * p);
        scale = 1 - 0.6 * p;
        visible = p < 1;
        if (p >= 1 && target.call.phrase === currentPhrase) full = true;
      } else if (visible && target.missedAt !== null) {
        // Miss：左右抖一下，留到这一乐句结束再淡出
        const since = beat - session.beatAt(target.missedAt);
        if (since < SHAKE_BEATS) {
          x += Math.sin(since * Math.PI * 16) * 7 * (1 - since / SHAKE_BEATS);
        }
        alpha = 1 - clamp01((beat - this.phraseEnd(target)) / FADE_BEATS);
        visible = alpha > 0;
      } else if (visible) {
        // 从上方落下，在示范拍点那一刻落地并轻弹一下
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

    // 挤压回弹 → 停留 → 淡出
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

  /** 判定字样放在目标上方（虚拟屏幕坐标） */
  private judgementAnchor(target: MacTarget): { x: number; y: number } {
    const { dock } = this.options;
    if (target.kind === 'dock' || target.kind === 'mail') {
      const center = dock.iconCenter(this.dockIndex(target));
      return { x: dock.view.x + center.x, y: dock.view.y - BOUNCE_HEIGHT };
    }
    if (target.kind === 'menu') {
      // 菜单右边，菜单栏下方
      return { x: this.menuOrigin.x + this.menu.width + 60, y: this.menuOrigin.y + 50 };
    }
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
 * Dock 弹跳的高度：拍点前 1 拍起跳、在拍点上落下（第一跳），之后每拍小跳一次，一直等到被点中。
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
    // 警告提示框：黄色三角，右下角带程序小图标
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
