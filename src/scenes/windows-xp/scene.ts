// 场景：Windows XP 桌面（doc/scenes/windows-xp.md）。
// MVP 玩法（doc/prototypes/mvp.md）：电脑按节奏弹出消息框，玩家按同样的节奏把它们关掉。
// 进场景先在资源管理器里用鼠标选关（doc/level-select.md）。
// 进关后先跑系统演示：谱面用到的每种动作各一轮小谱面，成功才进下一种，全部成功后才开始正文（doc/level-design.md「规则 1」）。
// XP 界面按原版像素尺寸画在 1024×576 的虚拟屏幕上，整体放大铺满画布；轮次横幅和判定字样按画布坐标画。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container, Rectangle } from 'pixi.js';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import { recordScore } from '../../game/records.ts';
import type { ActionType } from '../../rhythm/actions.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { summarizeResult } from '../../rhythm/result-summary.ts';
import { buildTurnCues, turnCueAt, type TurnCue } from '../../rhythm/turn-cue.ts';
import {
  buildTutorialChart,
  tutorialActions,
  tutorialHint,
  tutorialPassed,
} from '../../rhythm/tutorial.ts';
import { loadSkipTutorial } from '../../game/settings.ts';
import { TutorialCaption } from '../../ui/tutorial-caption.ts';
import { BEATS, THEMES } from '../../theme/tokens.ts';
import { clamp01, easeOutBack } from '../../ui/easing.ts';
import { createJudgementView } from '../../ui/judgement-view.ts';
import { TurnBanner } from '../../ui/turn-banner.ts';
import { SCENE_CATALOG } from '../catalog.ts';
import { preloadXpAssets, XP_CURSOR, xpAssets } from './assets.ts';
import { XpDesktop } from './components/desktop.ts';
import { XpMessageBox } from './components/message-box.ts';
import {
  WORK_AREA_HEIGHT,
  XP_SCALE,
  XP_SCREEN_HEIGHT,
  XP_SCREEN_WIDTH,
} from './components/screen.ts';
import { XpTaskbar } from './components/taskbar.ts';
import { isDialogKind, type DialogKind } from './dialog-kinds.ts';
import { PopupSession, type JudgementRecord, type PopupWindowState } from './popup-session.ts';
import { EXPLORER_TITLE, XpLevelSelect } from './level-select.ts';
import { XpResultsWindow } from './results-window.ts';
import { ShellTargetsView, windowSlotIndex } from './shell-targets-view.ts';
import { createPopupSounds, type PopupSounds } from './song.ts';
import { VirtualMouse } from './virtual-mouse.ts';
import { WaitHoldView } from './wait-hold-view.ts';

const theme = THEMES.xp;

/** 轮次横幅中心的纵坐标（画布坐标），在最上排消息框之上 */
const BANNER_Y = 38;
/** 演示提示条的左边（画布坐标）：轮次横幅（宽 240）右边再留一点空 */
const CAPTION_X = (XP_SCREEN_WIDTH * XP_SCALE) / 2 + 136;

/** 一个乐句里各消息框的中心位置（虚拟屏幕坐标），按乐句内序号依次使用 */
const SLOTS = [
  { x: 205, y: 135 },
  { x: 512, y: 112 },
  { x: 822, y: 150 },
  { x: 265, y: 335 },
  { x: 578, y: 312 },
  { x: 842, y: 368 },
];
/** 游戏中消息框正文的最大宽度，超过就换行 */
const POPUP_TEXT_WIDTH = 210;

/** 消息框文案：模仿当年弹窗广告和系统提示的腔调，全部原创 */
const POPUP_TEXTS: Record<DialogKind, { title: string; text: string }[]> = {
  'dialog-info': [
    { title: '恭喜您！', text: '您是本站第 100000 位访客，请点击领取大奖。' },
    { title: '新消息', text: '您有 1 条新的好友请求。' },
    { title: '网络连接', text: '已连接到 Internet。速度：56.0 Kbps' },
    { title: '温馨提示', text: '您的邮箱已满，请及时清理。' },
  ],
  'dialog-warning': [
    { title: '安全警告', text: '发现 3 个可疑文件，建议立即扫描。' },
    { title: '磁盘空间不足', text: '本地磁盘 (C:) 的空间不足。' },
    { title: '电池电量低', text: '电池电量只剩 5%，请接上电源。' },
  ],
  'dialog-error': [
    { title: '应用程序错误', text: '该程序执行了非法操作，即将关闭。' },
    { title: '找不到文件', text: '找不到文件 C:\\WINDOWS\\system32\\fun.dll。' },
    { title: '网页错误', text: '无法显示网页。请检查网络连接。' },
  ],
  'dialog-question': [
    { title: '免费下载', text: '是否下载最新动态屏保？完全免费！' },
    { title: '系统提示', text: '您的电脑运行缓慢，是否立即优化？' },
    { title: '记事本', text: '是否保存对「无标题」的更改？' },
  ],
};

/** Miss 后标题栏闪烁：每隔多少拍切换一次活动 / 非活动，闪多久（拍） */
const FLASH_STEP_BEATS = 0.125;
const FLASH_BEATS = 0.75;
/** 消息框、判定字样淡出的时长（拍） */
const FADE_BEATS = 0.25;
/** 结果出来后多久才接受「再来一次」的输入（毫秒），避免连按误触 */
const RESULT_INPUT_DELAY_MS = 600;

/**
 * select：资源管理器里选关；ready：选好了一关，游戏外壳正显示开场页，等第一下空格或点击；
 * starting：等音频恢复；playing：一局进行中；result：显示结果。
 * 选关和结果时点画面不算节奏输入（onTap 不处理），只认鼠标点到的按钮、图标和键盘。
 */
type State = 'select' | 'ready' | 'starting' | 'playing' | 'result';

/** 资源管理器窗口在虚拟屏幕上的位置和大小（设计稿 1120×630 换算到 1024×576） */
const EXPLORER = { x: 64, y: 19, width: 896, height: 504 };

interface ActiveJudgement {
  record: JudgementRecord;
  view: Container;
}

class WindowsXpScene implements Scene {
  readonly view = new Container({ label: 'windows-xp' });
  private readonly context: SceneContext;
  /** 这台电脑上的全部谱面（doc/level-select.md） */
  private readonly charts: Chart[];
  /** Follow me / Your turn 横幅：示范用凸起的按钮色，跟打用强调色 */
  private readonly turnBanner = new TurnBanner({
    call: { fill: theme.surfaceRaised, text: theme.ink, line: theme.line },
    response: { fill: theme.accent, text: theme.onAccent, line: theme.highlight },
  });
  /** 系统演示的提示条，颜色同横幅的 Follow me 一面 */
  private readonly caption = new TutorialCaption({
    fill: theme.surfaceRaised,
    text: theme.ink,
    line: theme.line,
  });
  private readonly sounds: PopupSounds;
  /** 虚拟 XP 屏幕：放大 XP_SCALE 倍铺满画布 */
  private readonly screen = new Container({ label: 'xp-screen' });
  private readonly desktop = new XpDesktop();
  private readonly taskbar = new XpTaskbar({
    tasks: [{ icon: 'folder-open', label: EXPLORER_TITLE }],
  });
  private readonly explorer: XpLevelSelect;
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  /** 一局里的虚拟鼠标和右键菜单，在 XP 界面最上层 */
  private readonly pointerLayer = new Container({ label: 'pointer' });
  /**
   * 一局里盖在画面最上面的透明层，鼠标移上去时把玩家自己的指针藏起来，免得和虚拟鼠标混在一起。
   * 不拦截节奏输入（节奏输入在 DOM 上监听）。
   */
  private readonly cursorCover = new Container({ label: 'cursor-cover' });
  /** 场景自己的音效出口（点击声、结果的 tada）；一局里的声音走 PopupSession 的出口 */
  private readonly output: GainNode;

  private state: State = 'select';
  /** 选中的这一关的谱面（演示时 session.chart 是演示用的小谱面，这里仍是正文谱面） */
  private chart: Chart | null = null;
  /** 系统演示进行到哪：要演示的动作、第几个、这一轮是不是重来；不在演示时为 null */
  private tutorial: { actions: ActionType[]; index: number; retry: boolean } | null = null;
  private turnCues: TurnCue[] = [];
  private session: PopupSession | null = null;
  /** 每个谱面事件的消息框；不是消息框的动作（desktop-refresh）为 null */
  private popups: (XpMessageBox | null)[] = [];
  /** 托盘气泡、程序窗口、开始菜单、回收站文件（doc/scenes/windows-xp-levels.md） */
  private shellView: ShellTargetsView | null = null;
  /** 下载进度窗、音量控制（doc/scenes/windows-xp-levels.md「等待与长按」） */
  private waitHoldView: WaitHoldView | null = null;
  private virtualMouse: VirtualMouse | null = null;
  private judgementViews: ActiveJudgement[] = [];
  private shownJudgements = 0;
  private dialog: XpMessageBox | null = null;
  /** 结算窗口（doc/results.md）；不在结算时为 null */
  private results: XpResultsWindow | null = null;
  /** 结算窗口上回车 / 空格对应的默认按钮 */
  private resultDefault: () => void = () => {};
  private resultShownAt = 0;
  private destroyed = false;

  constructor(context: SceneContext) {
    this.context = context;
    this.charts = context.charts.filter((chart) => chart.scene === windowsXpScene.id);
    const audio = context.clock.context;
    this.sounds = createPopupSounds(audio, xpAssets().sounds);
    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.explorer = new XpLevelSelect({
      charts: this.charts,
      width: EXPLORER.width,
      height: EXPLORER.height,
      onStart: (index) => this.openLevel(index),
      onBack: () => context.leave(),
    });
    this.explorer.view.position.set(EXPLORER.x, EXPLORER.y);
    this.taskbar.setTaskActive(0, true);

    this.screen.scale.set(XP_SCALE);
    this.taskbar.view.y = XP_SCREEN_HEIGHT - this.taskbar.view.height;
    this.screen.addChild(
      this.desktop.view,
      this.explorer.view,
      this.windowLayer,
      this.dialogLayer,
      this.taskbar.view,
      this.pointerLayer,
    );
    this.turnBanner.view.position.set((XP_SCREEN_WIDTH * XP_SCALE) / 2, BANNER_Y);
    this.cursorCover.hitArea = new Rectangle(
      0,
      0,
      XP_SCREEN_WIDTH * XP_SCALE,
      XP_SCREEN_HEIGHT * XP_SCALE,
    );
    this.cursorCover.cursor = 'none';
    this.cursorCover.eventMode = 'none';
    this.caption.view.position.set(CAPTION_X, BANNER_Y);
    this.view.addChild(
      this.screen,
      this.judgementLayer,
      this.turnBanner.view,
      this.caption.view,
      this.cursorCover,
    );

    if (this.charts.length === 0) {
      this.showDialog({
        kind: 'dialog-error',
        title: '没有可用的谱面',
        text: '谱面没有加载成功，原因见浏览器控制台。\n谱面文件放在 public/charts/ 目录下。',
        buttons: [{ label: '确定', onTap: () => this.hideDialog() }],
      });
    }
    // 网址 #windows-xp/谱面 直接打开某一关：资源管理器里选中它，跳过列表
    const direct = this.charts.findIndex((chart) => chart.id === context.chartId);
    if (direct >= 0) {
      this.explorer.select(direct);
      this.ready(this.charts[direct]!);
    }
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update({ audioTime }: FrameInfo): void {
    // 任务栏时钟只是装饰，显示本机时间，不参与节奏
    this.taskbar.setClock(new Date());

    const session = this.session;
    if (this.state !== 'playing' || !session) return;

    session.update(audioTime);
    const beat = session.beatAt(audioTime);
    this.renderPopups(session, beat);
    this.shellView?.update(beat, this.focusedWindow(session, beat));
    this.virtualMouse?.update(beat);
    if (this.virtualMouse) this.waitHoldView?.update(beat, this.virtualMouse.position);
    this.renderJudgements(session, beat);
    this.renderTurnBanner(beat);
    this.renderCaption();

    if (audioTime < session.endTime) return;
    if (this.tutorial) this.nextTutorialRound(session);
    else this.finish(session);
  }

  /** 只有一局进行中时，空格和点画面才是节奏输入；开场页上的第一下开始这一关 */
  onTap({ audioTime }: TapInfo): void {
    if (this.state === 'playing') this.session?.tap(audioTime);
    else if (this.state === 'ready' && this.chart) void this.start(this.chart);
  }

  /** 松开：只有一局进行中、正按住 volume-mute 时才有意义 */
  onRelease({ audioTime }: TapInfo): void {
    if (this.state === 'playing') this.session?.release(audioTime);
  }

  /** 关卡里、结果框上按 Esc 回到关卡列表；关卡列表上交给游戏入口回网吧 */
  onEscape(): boolean {
    if (this.state === 'select') return false;
    this.backToList();
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearRound();
    this.hideDialog();
    this.output.disconnect();
    this.view.destroy({ children: true });
  }

  // ---------- 流程 ----------

  /** 选关：方向键选择、回车开始；结算：回车或空格按默认按钮，R 重试 */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (this.state === 'select' && !this.dialog) {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const move = moves[event.code];
      if (move) {
        event.preventDefault();
        this.explorer.move(...move);
      } else if (event.code === 'Enter' && this.charts.length > 0) {
        this.openLevel(this.explorer.selectedIndex);
      }
    } else if (this.state === 'result') {
      if (event.code === 'Enter' || event.code === 'Space') this.resultDefault();
      else if (event.code === 'KeyR') this.retry();
    }
  };

  /** 双击图标或点「开始这一关」：响一声资源管理器的点击声，进这一关的开场页 */
  private openLevel(index: number): void {
    const chart = this.charts[index];
    if (!chart || this.state !== 'select') return;
    this.playNow(this.sounds.close);
    this.ready(chart);
  }

  /**
   * 选好了一关：收起资源管理器，请游戏外壳显示开场页，等玩家第一下空格或点击再开始。
   * 没有开场页时（原型页面等）直接开始。
   */
  private ready(chart: Chart): void {
    if (!this.context.introduce) {
      void this.start(chart);
      return;
    }
    this.clearRound();
    this.hideDialog();
    this.chart = chart;
    this.state = 'ready';
    this.setExplorerVisible(false);
    this.context.introduce(chart.id);
  }

  /** 结算后重试：刚演示过，不再演示，直接从正文开始 */
  private retry(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    if (this.chart) void this.start(this.chart, false);
  }

  /** 结算后直接玩列表里的下一关，资源管理器里的选中也跟过去 */
  private next(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    const index = this.chart ? this.charts.indexOf(this.chart) + 1 : -1;
    const chart = this.charts[index];
    if (!chart) return;
    this.explorer.select(index);
    this.ready(chart);
  }

  /**
   * 开始一关。withTutorial 时先跑系统演示（设置里打开了「跳过演示」就不跑），演示完再开始正文。
   */
  private async start(chart: Chart, withTutorial = true): Promise<void> {
    this.state = 'starting';
    this.chart = chart;
    await this.context.clock.resume();
    // 等待音频恢复期间可能已经离开场景，或按了 Esc
    if (this.destroyed || this.state !== 'starting') return;

    const actions = withTutorial && !loadSkipTutorial() ? tutorialActions(chart) : [];
    this.tutorial = actions.length > 0 ? { actions, index: 0, retry: false } : null;
    this.beginRound(this.tutorial ? buildTutorialChart(chart, actions[0]!) : chart);
  }

  /**
   * 演示的一轮结束：成功就演示下一种动作，失败就重来这一种；全部成功后开始正文。
   * 演示不计分，不进结算和最好成绩。
   */
  private nextTutorialRound(session: PopupSession): void {
    const tutorial = this.tutorial;
    const chart = this.chart;
    if (!tutorial || !chart) return;
    const targets = session.windows.reduce((n, state) => n + state.clicks.length, 0);
    const passed = tutorialPassed(
      session.judgements.map((j) => j.level),
      targets,
    );
    if (passed) tutorial.index++;
    tutorial.retry = !passed;
    const action = tutorial.actions[tutorial.index];
    if (action === undefined) {
      this.tutorial = null;
      this.beginRound(chart);
    } else {
      this.beginRound(buildTutorialChart(chart, action));
    }
  }

  /** 开一轮：正文谱面，或演示用的小谱面 */
  private beginRound(chart: Chart): void {
    this.clearRound();
    this.hideDialog();
    this.setExplorerVisible(false);
    this.turnCues = buildTurnCues(chart);
    this.session = new PopupSession(this.context, chart, this.sounds);
    const session = this.session;
    this.popups = session.windows.map((w, event) => this.createPopup(session, w, event));
    this.shellView = new ShellTargetsView({
      session,
      desktop: this.desktop,
      taskbar: this.taskbar,
      windowLayer: this.windowLayer,
      slots: SLOTS,
    });
    // 文件摆在桌面上（窗口之下）；气泡、开始菜单在任务栏之上、虚拟鼠标之下
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
    this.virtualMouse = new VirtualMouse(this.session, this.desktop, (state, event) =>
      this.clickPoints(state, event),
    );
    this.pointerLayer.addChild(this.virtualMouse.view);
    this.cursorCover.eventMode = 'static';
    this.state = 'playing';
  }

  /** 一局结束：弹出结算窗口（doc/results.md），记下最好得分 */
  private finish(session: PopupSession): void {
    const chart = session.chart;
    const summary = summarizeResult(
      session.judgements.map((j) => ({
        level: j.level,
        offset: j.offset,
        phrase: session.windows[j.event]?.call.phrase ?? 0,
      })),
    );
    const newRecord = recordScore(chart.id, summary.score);
    const hasNext = this.charts.indexOf(chart) < this.charts.length - 1;
    this.clearRound();
    this.hideDialog();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.resultDefault = hasNext ? () => this.next() : () => this.retry();
    this.results = new XpResultsWindow({
      title: chart.title,
      summary,
      newRecord,
      hasNext,
      onRetry: () => this.retry(),
      onList: () => this.backToList(),
      onNext: () => this.next(),
    });
    this.results.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(this.results.view);
    this.playNow(this.sounds.result);
  }

  private backToList(): void {
    this.clearRound();
    this.tutorial = null;
    this.state = 'select';
    this.hideDialog();
    this.setExplorerVisible(true);
  }

  /** 资源管理器在前面时任务栏按钮是按下的；一局里窗口收起，按钮弹起 */
  private setExplorerVisible(visible: boolean): void {
    this.explorer.view.visible = visible;
    this.explorer.setActive(visible);
    this.taskbar.setTaskActive(0, visible);
  }

  /** 切到后台时浏览器会降频，计时不再可靠，直接中止这一局，回到关卡列表 */
  private readonly onVisibilityChange = () => {
    if (!document.hidden || this.state !== 'playing') return;
    this.backToList();
  };

  private clearRound(): void {
    this.session?.stop();
    this.session = null;
    for (const popup of this.popups) popup?.destroy();
    this.popups = [];
    this.shellView?.destroy();
    this.shellView = null;
    this.waitHoldView?.destroy();
    this.waitHoldView = null;
    this.virtualMouse?.destroy();
    this.virtualMouse = null;
    this.cursorCover.eventMode = 'none';
    for (const { view } of this.judgementViews) view.destroy({ children: true });
    this.turnBanner.show(null);
    this.caption.show(null);
    this.judgementViews = [];
    this.shownJudgements = 0;
  }

  /** 屏幕中央的消息框；按钮可以用鼠标点（悬停变橙、按下变暗，和原版一样） */
  private showDialog(options: {
    kind: DialogKind;
    title: string;
    text: string;
    buttons: { label: string; onTap: () => void }[];
  }): void {
    this.hideDialog();
    this.explorer.setActive(false);
    const dialog = new XpMessageBox({
      kind: options.kind,
      title: options.title,
      text: options.text,
      buttons: options.buttons.map((b) => b.label),
      maxTextWidth: 320,
    });
    dialog.buttons.forEach((button, i) => {
      const { onTap } = options.buttons[i]!;
      button.view.eventMode = 'static';
      button.view.on('pointerover', () => button.setHot(true));
      button.view.on('pointerout', () => {
        button.setHot(false);
        button.setPressed(false);
      });
      button.view.on('pointerdown', () => button.setPressed(true));
      button.view.on('pointertap', onTap);
    });
    dialog.view.position.set(XP_SCREEN_WIDTH / 2, WORK_AREA_HEIGHT / 2);
    this.dialogLayer.addChild(dialog.view);
    this.dialog = dialog;
  }

  private hideDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
    this.results?.destroy();
    this.results = null;
    if (this.state === 'select') this.explorer.setActive(true);
  }

  private playNow(buffer: AudioBuffer): void {
    const source = this.context.clock.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
  }

  // ---------- 画面 ----------

  /** 消息框动作建一个消息框；别的动作（desktop-refresh）没有消息框，返回 null */
  private createPopup(
    session: PopupSession,
    state: PopupWindowState,
    event: number,
  ): XpMessageBox | null {
    const { phrase, index, action } = state.call;
    if (!isDialogKind(action)) return null;
    const kind: DialogKind = action;
    const texts = POPUP_TEXTS[kind];
    const text = texts[(phrase * 3 + index) % texts.length]!;
    const popup = new XpMessageBox({ kind, ...text, maxTextWidth: POPUP_TEXT_WIDTH });
    // 和程序窗口共用屏幕位置：按乐句里第几个「消息框或程序窗口」排
    const slot = SLOTS[windowSlotIndex(session, event) % SLOTS.length]!;
    popup.view.position.set(slot.x, slot.y);
    popup.view.visible = false;
    this.windowLayer.addChild(popup.view);
    return popup;
  }

  private renderPopups(session: PopupSession, beat: number): void {
    const focus = this.focusedWindow(session, beat);

    session.windows.forEach((state, i) => {
      const popup = this.popups[i];
      if (!popup) return;
      const view = popup.view;
      const appearBeat = state.call.beat - BEATS.windowOpen;
      let visible = beat >= appearBeat;
      let scale = 1;
      let alpha = 1;
      let active = i === focus;

      if (visible && state.closedAt !== null) {
        // 关闭：虚拟鼠标点下默认按钮，从玩家输入那一刻开始缩小淡出
        popup.buttons[0]?.setPressed(true);
        const p = (beat - session.beatAt(state.closedAt)) / BEATS.windowClose;
        visible = p < 1;
        scale = 1 - 0.2 * clamp01(p);
        alpha = 1 - clamp01(p);
      } else if (visible && state.missedAt !== null) {
        // Miss：像原版点到模态框外面那样，标题栏闪几下；留到这一小节结束再淡出
        const sinceMiss = beat - session.beatAt(state.missedAt);
        if (sinceMiss < FLASH_BEATS) active = Math.floor(sinceMiss / FLASH_STEP_BEATS) % 2 === 0;
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
      popup.setActive(active);
    });
  }

  /**
   * 虚拟鼠标要点的位置（虚拟屏幕坐标），每一下一个。消息框点默认按钮的中心。
   * desktop-refresh 的位置由 VirtualMouse 自己算；新动作在这里补上自己的位置。
   */
  private clickPoints(state: PopupWindowState, event: number): { x: number; y: number }[] {
    const popup = this.popups[event];
    if (popup) {
      const button = popup.buttonCenter();
      return [{ x: popup.view.x + button.x, y: popup.view.y + button.y }];
    }
    // 下载窗点「Open」，音量控制按下、松开在滑块上
    const waitHold = this.waitHoldView?.clickPoints(event);
    if (waitHold) return waitHold;
    // 气泡点关闭、程序窗口点最小化、开始菜单点「开始」和菜单项、文件点它自己
    const shell = this.shellView?.clickPoints(event);
    if (shell) return shell;
    // 还没有专门位置的动作：每一下都点在屏幕中央
    return state.clicks.map(() => ({ x: XP_SCREEN_WIDTH / 2, y: WORK_AREA_HEIGHT / 2 }));
  }

  /**
   * 活动窗口：示范小节里是最新弹出的那个；空档和跟打小节里是下一个该关的那个。
   * 其余消息框用非活动标题栏，让玩家看懂下一个目标。
   */
  private focusedWindow(session: PopupSession, beat: number): number {
    const phraseIndex = session.chart.phrases.findIndex((p) => beat >= p.callStart && beat < p.end);
    if (phraseIndex < 0) return -1;
    const phrase = session.chart.phrases[phraseIndex]!;
    const windows = session.windows
      .map((state, i) => ({ state, i }))
      .filter(({ state }) => state.call.phrase === phraseIndex);

    if (beat < phrase.callEnd) {
      return windows.filter(({ state }) => state.call.beat <= beat).at(-1)?.i ?? -1;
    }
    return windows.find(({ state }) => state.closedAt === null && state.missedAt === null)?.i ?? -1;
  }

  /** 演示提示条：第几种动作（或「Try again」）和怎么处理 */
  private renderCaption(): void {
    const tutorial = this.tutorial;
    const action = tutorial?.actions[tutorial.index];
    if (!tutorial || action === undefined) {
      this.caption.show(null);
      return;
    }
    const hint = tutorialHint(action);
    const step = tutorial.retry
      ? 'Try again'
      : `Practice ${tutorial.index + 1} of ${tutorial.actions.length}`;
    this.caption.show({ title: `${step} · ${hint.name}`, how: hint.how });
  }

  /** 轮次横幅：切换时挤压回弹一次 */
  private renderTurnBanner(beat: number): void {
    const cue = turnCueAt(this.turnCues, beat);
    if (!cue) {
      this.turnBanner.show(null);
      return;
    }
    this.turnBanner.show(cue.turn, 1 - clamp01((beat - cue.start) / BEATS.squash));
  }

  private renderJudgements(session: PopupSession, beat: number): void {
    // 新出现的判定，放在对应消息框的上方（换算成画布坐标）
    for (; this.shownJudgements < session.judgements.length; this.shownJudgements++) {
      const record = session.judgements[this.shownJudgements]!;
      const view = createJudgementView(record.level);
      const state = session.windows[record.event]!;
      const popup = this.popups[record.event];
      const shellAnchor =
        this.shellView?.judgementAnchor(record.event) ??
        this.waitHoldView?.judgementAnchor(record.event);
      if (popup) {
        const slot = SLOTS[windowSlotIndex(session, record.event) % SLOTS.length]!;
        view.position.set(slot.x * XP_SCALE, (slot.y - popup.height / 2) * XP_SCALE - 20);
      } else if (shellAnchor) {
        view.position.set(shellAnchor.x * XP_SCALE, shellAnchor.y * XP_SCALE - 20);
      } else {
        // 没有消息框的动作（desktop-refresh）：显示在右键位置的上方
        const spot = VirtualMouse.refreshSpot(state);
        view.position.set(spot.x * XP_SCALE, spot.y * XP_SCALE - 40);
      }
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
