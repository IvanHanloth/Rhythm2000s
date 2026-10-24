// 一局里各个目标的画面：提示框、文稿窗口、Dock 弹跳、Mail 未读角标，以及判定字样。
// 每帧只根据当前拍位置计算，不累加帧间隔（doc/scenes/mac-2000.md「玩法」）。

import { Container } from 'pixi.js';
import { BEATS } from '../../theme/tokens.ts';
import { clamp01, easeOutBack, easeOutCubic } from '../../ui/easing.ts';
import { createJudgementView } from '../../ui/judgement-view.ts';
import type { MacAction } from './action-kinds.ts';
import { appIcon, type AppIconName } from './assets.ts';
import { AquaAlert } from './components/alert.ts';
import type { Dock } from './components/dock.ts';
import { drawCautionIcon, drawFinderIcon } from './components/icons.ts';
import { aquaText } from './components/paint.ts';
import { AquaWindow } from './components/window.ts';
import type { JudgementRecord, MacSession, MacTarget } from './session.ts';

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

type AlertAction = Extract<MacAction, `alert-${string}`>;

/** 提示框文案：模仿 Mac OS X 当年的系统提示，全部原创 */
const ALERT_TEXTS: Record<
  AlertAction,
  { app: AppIconName | 'finder'; message: string; informative: string }[]
> = {
  'alert-note': [
    {
      app: 'System Preferences',
      message: '有新的软件可用。',
      informative: '「软件更新」找到了 3 个适用于这台电脑的更新。',
    },
    { app: 'Safari', message: '下载已完成。', informative: '「iTunes.dmg」已存放到桌面上。' },
    { app: 'iChat', message: '有人邀请你聊天。', informative: '「小明」想和你开始一个聊天。' },
  ],
  'alert-caution': [
    {
      app: 'finder',
      message: '确定要清倒废纸篓吗？',
      informative: '废纸篓里有 12 个项目。此操作不能撤销。',
    },
    {
      app: 'System Preferences',
      message: '电池电量不足。',
      informative: '请接上电源适配器，否则电脑很快会进入睡眠。',
    },
    {
      app: 'finder',
      message: '磁盘「Macintosh HD」几乎已满。',
      informative: '请删除一些文件，腾出磁盘空间。',
    },
  ],
  'alert-stop': [
    {
      app: 'iTunes',
      message: '应用程序「iTunes」意外退出。',
      informative: '系统和其他应用程序未受影响。',
    },
    {
      app: 'Mail',
      message: '无法连接到邮件服务器。',
      informative: '请检查网络设置，然后再试一次。',
    },
    {
      app: 'TextEdit',
      message: '找不到文稿「作业.rtf」。',
      informative: '原始文件可能已被移动或删除。',
    },
  ],
};

/** 文稿窗口：标题和正文，全部原创 */
const DOCUMENTS = [
  { title: '未命名', text: '亲爱的：\n今天天气很好，我们去公园吧。' },
  { title: '读我.rtf', text: '感谢您选购本软件。\n安装前请先阅读以下说明。' },
  { title: '购物清单.txt', text: '牛奶\n鸡蛋\nZip 磁盘 ×2' },
  { title: '日记.rtf', text: '2002 年 8 月 24 日\n今天升级到了 Jaguar。' },
  { title: '作业.rtf', text: '第三章 习题\n1. 请说明……' },
  { title: '歌单.txt', text: '1. 晴天\n2. 七里香\n3. ……' },
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
  /** 虚拟屏幕放大到画布的倍数 */
  screenScale: number;
}

export class MacTargetsView {
  private readonly session: MacSession;
  private readonly options: TargetsViewOptions;
  private readonly screenTargets: ScreenTarget[] = [];
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
      }
    });
  }

  update(audioTime: number): void {
    const beat = this.session.beatAt(audioTime);
    const focus = this.focusedTarget(beat);
    this.renderScreenTargets(beat, focus, audioTime);
    this.renderDock(beat);
    this.renderJudgements(beat);
  }

  destroy(): void {
    for (const { window } of this.screenTargets) window.destroy();
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
          // 按下「好」：提示框缩小淡出
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

  private renderJudgements(beat: number): void {
    const { session } = this;
    const { judgementLayer, screenScale } = this.options;
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const at = this.judgementAnchor(session.targets[record.target]!);
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
      const index =
        target.kind === 'mail'
          ? MAIL_DOCK_INDEX
          : BOUNCE_DOCK_INDICES[target.order % BOUNCE_DOCK_INDICES.length]!;
      const center = dock.iconCenter(index);
      return { x: dock.view.x + center.x, y: dock.view.y - BOUNCE_HEIGHT };
    }
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
      buttons: [{ label: '好', isDefault: true }],
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
