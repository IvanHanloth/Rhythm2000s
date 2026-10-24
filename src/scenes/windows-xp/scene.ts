// 场景：Windows XP 桌面（doc/scenes/windows-xp.md）。
// MVP 玩法「弹窗 → 关窗」（doc/prototypes/mvp.md）：电脑按节奏弹出窗口，玩家按同样的节奏把它们关掉。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { BEATS, FONT_FAMILIES, THEMES } from '../../theme/tokens.ts';
import { clamp01, easeOutBack } from '../../ui/easing.ts';
import { createJudgementView } from '../../ui/judgement-view.ts';
import { PopupSession, type JudgementRecord, type PopupWindowState } from './popup-session.ts';
import { PopupWindow } from './popup-window.ts';
import { buildPopupChart, createPopupSounds, type PopupSounds } from './song.ts';

const theme = THEMES.xp;
const TASKBAR_HEIGHT = 40;
const START_BUTTON_WIDTH = 110;

const POPUP_WIDTH = 300;
const POPUP_HEIGHT = 150;
/** 一个乐句里各窗口的中心位置，按乐句内序号依次使用 */
const SLOTS = [
  { x: 240, y: 170 },
  { x: 640, y: 140 },
  { x: 1040, y: 190 },
  { x: 330, y: 420 },
  { x: 720, y: 390 },
  { x: 1060, y: 470 },
];
/** 弹窗文案：模仿当年弹窗广告和系统提示的腔调，全部原创 */
const POPUP_TEXTS = [
  { title: '恭喜您！', body: '您是本站第 100000 位访客，请点击领取大奖。' },
  { title: '系统提示', body: '您的电脑运行缓慢，是否立即优化？' },
  { title: '新消息', body: '您有 1 条新的好友请求。' },
  { title: '免费下载', body: '最新动态屏保，完全免费！' },
  { title: '安全警告', body: '发现 3 个可疑文件，建议立即扫描。' },
  { title: '网络连接', body: '已连接到 Internet。速度：56.0 Kbps' },
  { title: '温馨提示', body: '您的邮箱已满，请及时清理。' },
];

/** Miss 后窗口抖动的时长（拍） */
const SHAKE_BEATS = 0.25;
/** 窗口、判定字样淡出的时长（拍） */
const FADE_BEATS = 0.25;
/** 结果出来后多久才接受「再来一次」的输入（毫秒），避免连按误触 */
const RESULT_INPUT_DELAY_MS = 600;

type State = 'ready' | 'starting' | 'playing' | 'result';

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

class WindowsXpScene implements Scene {
  readonly view = new Container({ label: 'windows-xp' });
  private readonly context: SceneContext;
  private readonly chart: Chart = buildPopupChart();
  private readonly sounds: PopupSounds;
  private readonly taskbarFill = new FillGradient({
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: theme.titlebarHi },
      { offset: 1, color: theme.titlebar },
    ],
  });
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });

  private state: State = 'ready';
  private session: PopupSession | null = null;
  private popups: PopupWindow[] = [];
  private judgementViews: ActiveJudgement[] = [];
  private shownJudgements = 0;
  private dialog: PopupWindow | null = null;
  private resultShownAt = 0;
  private destroyed = false;

  constructor(context: SceneContext) {
    this.context = context;
    this.sounds = createPopupSounds(context.clock.context);
    this.view.addChild(this.drawDesktop(), this.windowLayer, this.judgementLayer, this.dialogLayer);
    this.showDialog({
      title: '弹窗大扫除',
      body: '电脑会先按节奏弹出一串窗口。\n轮到您时，请按同样的节奏把它们逐个关闭。\n\n按空格键或点击画面开始。',
      button: '开始',
    });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update({ audioTime }: FrameInfo): void {
    const session = this.session;
    if (this.state !== 'playing' || !session) return;

    session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderPopups(session, beat);
    this.renderJudgements(session, beat);

    if (audioTime >= session.endTime) this.finish(session);
  }

  onTap({ audioTime }: TapInfo): void {
    switch (this.state) {
      case 'ready':
        void this.start();
        break;
      case 'playing':
        this.session?.tap(audioTime);
        break;
      case 'result':
        if (performance.now() - this.resultShownAt >= RESULT_INPUT_DELAY_MS) void this.start();
        break;
      case 'starting':
        break;
    }
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearRound();
    this.dialog?.destroy();
    this.view.destroy({ children: true });
    this.taskbarFill.destroy();
  }

  // ---------- 流程 ----------

  private async start(): Promise<void> {
    this.state = 'starting';
    await this.context.clock.resume();
    // 等待音频恢复期间可能已经离开场景
    if (this.destroyed || this.state !== 'starting') return;

    this.clearRound();
    this.hideDialog();
    this.session = new PopupSession(this.context, this.chart, this.sounds);
    this.popups = this.session.windows.map((w) => this.createPopup(w));
    this.state = 'playing';
  }

  private finish(session: PopupSession): void {
    const { perfect, good, miss } = session.counts();
    this.clearRound();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.showDialog({
      title: '大扫除完成',
      body: `Perfect ${perfect}　　Good ${good}　　Miss ${miss}\n\n按空格键或点击画面，再来一次。`,
      button: '再来一次',
    });
  }

  /** 切到后台时浏览器会降频，计时不再可靠，直接中止这一局 */
  private readonly onVisibilityChange = () => {
    if (!document.hidden || this.state !== 'playing') return;
    this.clearRound();
    this.state = 'ready';
    this.showDialog({
      title: '已暂停',
      body: '页面切到了后台，这一局已中止。\n\n按空格键或点击画面重新开始。',
      button: '开始',
    });
  };

  private clearRound(): void {
    this.session?.stop();
    this.session = null;
    for (const popup of this.popups) popup.destroy();
    this.popups = [];
    for (const { view } of this.judgementViews) view.destroy({ children: true });
    this.judgementViews = [];
    this.shownJudgements = 0;
  }

  private showDialog(options: { title: string; body: string; button: string }): void {
    this.hideDialog();
    this.dialog = new PopupWindow({ ...options, width: 520, height: 230 });
    this.dialog.view.position.set(DESIGN_WIDTH / 2, (DESIGN_HEIGHT - TASKBAR_HEIGHT) / 2);
    this.dialogLayer.addChild(this.dialog.view);
  }

  private hideDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
  }

  // ---------- 画面 ----------

  private createPopup(state: PopupWindowState): PopupWindow {
    const { phrase, index } = state.call;
    const text = POPUP_TEXTS[(phrase * 3 + index) % POPUP_TEXTS.length]!;
    const popup = new PopupWindow({ ...text, width: POPUP_WIDTH, height: POPUP_HEIGHT });
    const slot = SLOTS[index % SLOTS.length]!;
    popup.view.position.set(slot.x, slot.y);
    popup.view.visible = false;
    this.windowLayer.addChild(popup.view);
    return popup;
  }

  private renderPopups(session: PopupSession, beat: number): void {
    const focus = this.focusedWindow(session, beat);

    session.windows.forEach((state, i) => {
      const popup = this.popups[i]!;
      const view = popup.view;
      const slot = SLOTS[state.call.index % SLOTS.length]!;
      const appearBeat = state.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let scale = 1;
      let alpha = 1;
      let shakeX = 0;

      if (visible && state.closedAt !== null) {
        // 关闭：从玩家输入那一刻开始缩小淡出
        const p = (beat - session.beatAt(state.closedAt)) / BEATS.windowClose;
        visible = p < 1;
        scale = 1 - 0.2 * clamp01(p);
        alpha = 1 - clamp01(p);
      } else if (visible && state.missedAt !== null) {
        // Miss：抖一下，留到这一小节结束再淡出
        const sinceMiss = beat - session.beatAt(state.missedAt);
        if (sinceMiss < SHAKE_BEATS) {
          shakeX = Math.sin(sinceMiss * Math.PI * 16) * 8 * (1 - sinceMiss / SHAKE_BEATS);
        }
        const phraseEnd = session.chart.phrases[state.call.phrase]!.end;
        const p = (beat - phraseEnd) / FADE_BEATS;
        visible = p < 1;
        alpha = 1 - clamp01(p);
      } else if (visible) {
        // 弹出：在示范拍点那一刻刚好弹到最大
        scale = easeOutBack((beat - appearBeat) / BEATS.windowOpen);
      }

      view.visible = visible;
      if (!visible) return;
      view.scale.set(Math.max(0.01, scale));
      view.alpha = alpha;
      view.position.set(slot.x + shakeX, slot.y);
      popup.setActive(i === focus);
    });
  }

  /**
   * 活动窗口：示范小节里是最新弹出的那个；跟打小节里是下一个该关的那个。
   * 其余窗口用非活动标题栏，让玩家看懂下一个目标。
   */
  private focusedWindow(session: PopupSession, beat: number): number {
    const phraseIndex = session.chart.phrases.findIndex((p) => beat >= p.callStart && beat < p.end);
    if (phraseIndex < 0) return -1;
    const phrase = session.chart.phrases[phraseIndex]!;
    const windows = session.windows
      .map((state, i) => ({ state, i }))
      .filter(({ state }) => state.call.phrase === phraseIndex);

    if (beat < phrase.responseStart) {
      return windows.filter(({ state }) => state.call.beat <= beat).at(-1)?.i ?? -1;
    }
    return windows.find(({ state }) => state.closedAt === null && state.missedAt === null)?.i ?? -1;
  }

  private renderJudgements(session: PopupSession, beat: number): void {
    // 新出现的判定
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const slot = SLOTS[session.windows[record.target]!.call.index % SLOTS.length]!;
      view.position.set(slot.x, slot.y - POPUP_HEIGHT / 2 - 20);
      this.judgementLayer.addChild(view);
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

  private drawDesktop(): Container {
    const taskbarTop = DESIGN_HEIGHT - TASKBAR_HEIGHT;
    const desktop = new Container({ label: 'desktop' });

    const wallpaper = new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill(theme.desktop)
      // 一道平缓的草坡
      .moveTo(0, 520)
      .bezierCurveTo(360, 430, 820, 440, DESIGN_WIDTH, 500)
      .lineTo(DESIGN_WIDTH, DESIGN_HEIGHT)
      .lineTo(0, DESIGN_HEIGHT)
      .closePath()
      .fill(theme.desktopHorizon);

    const taskbar = new Graphics()
      .rect(0, taskbarTop, DESIGN_WIDTH, TASKBAR_HEIGHT)
      .fill(this.taskbarFill)
      // 「开始」按钮只圆右侧两个角：左侧圆角画在舞台外，被舞台裁掉
      .roundRect(-16, taskbarTop, START_BUTTON_WIDTH + 16, TASKBAR_HEIGHT, 14)
      .fill(theme.desktopHorizon);

    // 20px 粗体属于大字号，白字在草绿底上满足 3:1
    const startLabel = new Text({
      text: '开始',
      style: {
        fontFamily: FONT_FAMILIES.ui,
        fontSize: 20,
        fontWeight: '700',
        fill: theme.highlight,
      },
    });
    startLabel.anchor.set(0.5);
    startLabel.position.set(START_BUTTON_WIDTH / 2, taskbarTop + TASKBAR_HEIGHT / 2);

    desktop.addChild(wallpaper, taskbar, startLabel);
    return desktop;
  }
}

export const windowsXpScene: SceneEntry = {
  id: 'windows-xp',
  label: 'Windows XP 桌面',
  create: (context) => new WindowsXpScene(context),
};
