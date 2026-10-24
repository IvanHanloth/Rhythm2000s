// 场景：2000 年前后的 Mac 桌面（doc/scenes/mac-2000.md），按简体中文版 Mac OS X 10.0–10.2 的早期 Aqua 还原。
// 玩法与 XP 的 MVP 相同：示范小节里电脑按节奏「出事」，跟打小节里玩家按同样的节奏逐个处理。
// 进场景先在 Finder 里用鼠标选关（doc/level-select.md）。
// 进关后先跑系统演示：谱面用到的每种动作各一轮小谱面，成功才进下一种，全部成功后才开始正文（doc/level-design.md「规则 1」）。
// Aqua 界面按原版像素尺寸画在 1024×576 的虚拟屏幕上，整体放大 1.25 倍铺满画布；轮次横幅和判定字样按画布坐标画。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import { recordScore } from '../../game/records.ts';
import { loadSkipTutorial } from '../../game/settings.ts';
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
import { AQUA } from '../../theme/aqua.ts';
import { BEATS, THEMES } from '../../theme/tokens.ts';
import { clamp01 } from '../../ui/easing.ts';
import { TurnBanner } from '../../ui/turn-banner.ts';
import { TutorialCaption } from '../../ui/tutorial-caption.ts';
import { SCENE_CATALOG } from '../catalog.ts';
import { macAssets, preloadMacAssets } from './assets.ts';
import { AquaAlert, type AquaAlertOptions } from './components/alert.ts';
import { Dock, DOCK_HEIGHT, type DockItem } from './components/dock.ts';
import { drawCautionIcon } from './components/icons.ts';
import { MenuBar } from './components/menu-bar.ts';
import { type PushButtonOptions } from './components/push-button.ts';
import { MacLevelSelect } from './level-select.ts';
import { MacResultsWindow } from './results-window.ts';
import { MacSession } from './session.ts';
import { createMacSongSounds, type MacSongSounds } from './song.ts';
import { MacTargetsView } from './targets-view.ts';
import { MacVirtualMouse } from './virtual-mouse.ts';

const theme = THEMES.aqua;
const SCREEN_SCALE = 1.25;
const SCREEN_WIDTH = DESIGN_WIDTH / SCREEN_SCALE;
const SCREEN_HEIGHT = DESIGN_HEIGHT / SCREEN_SCALE;

/** 轮次横幅中心的纵坐标（画布坐标），在菜单栏下方、最上排提示框之上 */
const BANNER_Y = 62;
/** 演示提示条的左边（画布坐标）：轮次横幅（宽 240）右边再留一点空 */
const CAPTION_X = DESIGN_WIDTH / 2 + 136;

const MENUS = ['文件', '编辑', '显示', '前往', '窗口', '帮助'];

/** Dock：Finder、Mail 一直在运行；其余 8 个给 dock-bounce 弹跳用（targets-view.ts 的 BOUNCE_DOCK_INDICES） */
const DOCK_ITEMS: DockItem[] = [
  { icon: 'finder', running: true },
  { icon: 'Mail', running: true },
  { icon: 'iChat' },
  { icon: 'Safari' },
  { icon: 'iTunes' },
  { icon: 'iPhoto' },
  { icon: 'iCal' },
  { icon: 'QuickTime Player' },
  { icon: 'Sherlock' },
  { icon: 'System Preferences' },
];

/** 提示框中心的纵坐标（虚拟屏幕） */
const DIALOG_Y = 250;
/** 结算窗口中心的纵坐标：菜单栏和 Dock 之间（虚拟屏幕） */
const RESULTS_Y = 266;
/** 结果出来后多久才接受「再来一次」的输入（毫秒），避免连按误触 */
const RESULT_INPUT_DELAY_MS = 600;

/**
 * select：Finder 里选关；ready：选好了一关，游戏外壳正显示开场页，等第一下空格或点击；
 * starting：等音频恢复；playing：一局进行中；result：显示结果。
 * 选关和结果时点画面不算节奏输入（onTap 不处理），只认鼠标点到的按钮、图标和键盘。
 */
type State = 'select' | 'ready' | 'starting' | 'playing' | 'result';

class Mac2000Scene implements Scene {
  readonly view = new Container({ label: 'mac-2000' });
  private readonly context: SceneContext;
  /** 这台电脑上的全部谱面（doc/level-select.md） */
  private readonly charts: Chart[];
  private readonly sounds: MacSongSounds;
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
  /** 系统演示进行到哪：要演示的动作、第几个、这一轮是不是重来；不在演示时为 null */
  private tutorial: { actions: ActionType[]; index: number; retry: boolean } | null = null;
  private readonly screen = new Container({ label: 'mac-screen' });
  private readonly menuBar = new MenuBar({ width: SCREEN_WIDTH, appName: 'Finder', menus: MENUS });
  private readonly dock = new Dock(DOCK_ITEMS);
  private readonly levelSelect: MacLevelSelect;
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  /** 一局里扔进废纸篓的文件，在 Dock 之上 */
  private readonly fileLayer = new Container({ label: 'files' });
  /** 一局里的苹果菜单，在菜单栏之上 */
  private readonly menuLayer = new Container({ label: 'menus' });
  /** 一局里的虚拟鼠标，在 Mac 界面最上层 */
  private readonly pointerLayer = new Container({ label: 'pointer' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  /**
   * 一局里盖在画面最上面的透明层，鼠标移上去时把玩家自己的指针藏起来，免得和虚拟鼠标混在一起。
   * 不拦截节奏输入（节奏输入在 DOM 上监听）。
   */
  private readonly cursorCover = new Container({ label: 'cursor-cover' });
  /** 场景自己的音效出口（结果音）；一局里的声音走 MacSession 的出口 */
  private readonly output: GainNode;

  private state: State = 'select';
  private chart: Chart | null = null;
  private turnCues: TurnCue[] = [];
  private session: MacSession | null = null;
  private targetsView: MacTargetsView | null = null;
  private virtualMouse: MacVirtualMouse | null = null;
  private dialog: AquaAlert | null = null;
  /** 结算窗口（doc/results.md）；不在结算时为 null */
  private results: MacResultsWindow | null = null;
  /** 结算窗口上回车 / 空格对应的默认按钮 */
  private resultDefault: () => void = () => {};
  private resultShownAt = 0;
  private destroyed = false;

  constructor(context: SceneContext) {
    this.context = context;
    this.charts = context.charts.filter((chart) => chart.scene === mac2000Scene.id);
    const audio = context.clock.context;
    this.sounds = createMacSongSounds(audio, macAssets().sounds);
    this.output = audio.createGain();
    this.output.gain.value = 0.8;
    this.output.connect(audio.destination);

    this.dock.view.position.set(
      Math.round((SCREEN_WIDTH - this.dock.width) / 2),
      SCREEN_HEIGHT - DOCK_HEIGHT,
    );

    this.levelSelect = new MacLevelSelect({
      charts: this.charts,
      onStart: (index) => this.openLevel(index),
      onBack: () => context.leave(),
    });

    this.screen.scale.set(SCREEN_SCALE);
    this.screen.addChild(
      createWallpaper(),
      this.levelSelect.view,
      this.windowLayer,
      this.dialogLayer,
      this.dock.view,
      this.fileLayer,
      this.menuBar.view,
      this.menuLayer,
      this.pointerLayer,
    );
    this.turnBanner.view.position.set(DESIGN_WIDTH / 2, BANNER_Y);
    this.cursorCover.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
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
        icon: drawCautionIcon(64),
        message: '没有可用的谱面。',
        informative: '谱面没有加载成功，原因见浏览器控制台。谱面文件放在 public/charts/ 目录下。',
        buttons: [{ label: '好', isDefault: true, onTap: () => this.hideDialog() }],
      });
    }
    // 网址 #mac-2000/谱面 直接打开某一关：Finder 里选中它，跳过列表
    const direct = this.charts.findIndex((chart) => chart.id === context.chartId);
    if (direct >= 0) {
      this.levelSelect.select(direct);
      this.ready(this.charts[direct]!);
    }

    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update({ audioTime }: FrameInfo): void {
    // 菜单栏时钟只是装饰，显示本机时间，不参与节奏
    this.menuBar.update(new Date());
    this.dialog?.update(audioTime);
    this.results?.update(audioTime);
    if (this.state === 'select') this.levelSelect.update(audioTime);

    const session = this.session;
    if (this.state !== 'playing' || !session) return;
    session.update(audioTime);
    this.targetsView?.update(audioTime);
    this.virtualMouse?.update(session.beatAt(audioTime));
    this.renderTurnBanner(session.beatAt(audioTime));
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

  /** 选关：方向键选择、回车开始；结果框：回车或空格再来一次 */
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
        this.levelSelect.move(...move);
      } else if (event.code === 'Enter' && this.charts.length > 0) {
        this.openLevel(this.levelSelect.selectedIndex);
      }
    } else if (this.state === 'result') {
      if (event.code === 'Enter' || event.code === 'Space') this.resultDefault();
      else if (event.code === 'KeyR') this.retry();
    }
  };

  private openLevel(index: number): void {
    const chart = this.charts[index];
    if (!chart || this.state !== 'select') return;
    this.ready(chart);
  }

  /**
   * 选好了一关：收起 Finder，请游戏外壳显示开场页，等玩家第一下空格或点击再开始。
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
    this.levelSelect.view.visible = false;
    this.context.introduce(chart.id);
  }

  /** 结算后重试：刚演示过，不再演示，直接从正文开始 */
  private retry(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    if (this.chart) void this.start(this.chart, false);
  }

  private backToList(): void {
    this.clearRound();
    this.tutorial = null;
    this.state = 'select';
    this.hideDialog();
    this.levelSelect.view.visible = true;
    this.levelSelect.setActive(true);
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
  private nextTutorialRound(session: MacSession): void {
    const tutorial = this.tutorial;
    const chart = this.chart;
    if (!tutorial || !chart) return;
    const targets = session.targets.reduce((n, target) => n + target.clicks.length, 0);
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
    this.levelSelect.view.visible = false;
    this.turnCues = buildTurnCues(chart);
    this.session = new MacSession(this.context, chart, this.sounds);
    this.targetsView = new MacTargetsView(this.session, {
      windowLayer: this.windowLayer,
      judgementLayer: this.judgementLayer,
      dock: this.dock,
      menuBar: this.menuBar,
      fileLayer: this.fileLayer,
      menuLayer: this.menuLayer,
      screenScale: SCREEN_SCALE,
    });
    const targetsView = this.targetsView;
    this.virtualMouse = new MacVirtualMouse(this.session, (_, event) =>
      targetsView.clickPoints(event),
    );
    this.pointerLayer.addChild(this.virtualMouse.view);
    this.cursorCover.eventMode = 'static';
    this.state = 'playing';
  }

  /** 结算后直接玩列表里的下一关，Finder 里的选中也跟过去 */
  private next(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    const index = this.chart ? this.charts.indexOf(this.chart) + 1 : -1;
    const chart = this.charts[index];
    if (!chart) return;
    this.levelSelect.select(index);
    this.ready(chart);
  }

  /** 一局结束：弹出结算窗口（doc/results.md），记下最好得分 */
  private finish(session: MacSession): void {
    const chart = session.chart;
    const summary = summarizeResult(
      session.judgements.map((j) => ({
        level: j.level,
        offset: j.offset,
        phrase: session.targets[j.event]?.call.phrase ?? 0,
      })),
    );
    const newRecord = recordScore(chart.id, summary.score);
    const hasNext = this.charts.indexOf(chart) < this.charts.length - 1;
    this.clearRound();
    this.hideDialog();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.resultDefault = hasNext ? () => this.next() : () => this.retry();
    this.results = new MacResultsWindow({
      title: chart.title,
      summary,
      newRecord,
      hasNext,
      onRetry: () => this.retry(),
      onList: () => this.backToList(),
      onNext: () => this.next(),
    });
    this.results.view.position.set(SCREEN_WIDTH / 2, RESULTS_Y);
    this.dialogLayer.addChild(this.results.view);
    this.playNow(this.sounds.result);
  }

  /** 切到后台时浏览器会降频，计时不再可靠，直接中止这一局，回到关卡列表 */
  private readonly onVisibilityChange = () => {
    if (!document.hidden || this.state !== 'playing') return;
    this.backToList();
  };

  private clearRound(): void {
    this.session?.stop();
    this.session = null;
    this.targetsView?.destroy();
    this.targetsView = null;
    this.virtualMouse?.destroy();
    this.virtualMouse = null;
    this.cursorCover.eventMode = 'none';
    this.turnCues = [];
    this.turnBanner.show(null);
    this.caption.show(null);
  }

  /** 屏幕中央的提示框；按钮可以用鼠标点 */
  private showDialog(
    options: Omit<AquaAlertOptions, 'buttons'> & {
      buttons: (PushButtonOptions & { onTap: () => void })[];
    },
  ): void {
    this.hideDialog();
    this.levelSelect.setActive(false);
    const dialog = new AquaAlert({ width: 400, ...options });
    dialog.buttons.forEach((button, i) => {
      const { onTap } = options.buttons[i]!;
      button.view.eventMode = 'static';
      button.view.on('pointerdown', () => (button.view.alpha = 0.75));
      button.view.on('pointerout', () => (button.view.alpha = 1));
      button.view.on('pointertap', () => {
        button.view.alpha = 1;
        onTap();
      });
    });
    dialog.view.position.set(SCREEN_WIDTH / 2, DIALOG_Y);
    this.dialogLayer.addChild(dialog.view);
    this.dialog = dialog;
  }

  private hideDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
    this.results?.destroy();
    this.results = null;
    if (this.state === 'select') this.levelSelect.setActive(true);
  }

  private playNow(buffer: AudioBuffer): void {
    const source = this.context.clock.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    source.start();
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
}

/** 壁纸按比例铺满屏幕，上下略裁 */
function createWallpaper(): Container {
  const wallpaper = new Container({ label: 'wallpaper' });
  const texture = macAssets().wallpaper;
  const sprite = new Sprite(texture);
  const scale = Math.max(SCREEN_WIDTH / texture.width, SCREEN_HEIGHT / texture.height);
  sprite.scale.set(scale);
  sprite.position.set(
    (SCREEN_WIDTH - texture.width * scale) / 2,
    (SCREEN_HEIGHT - texture.height * scale) / 2,
  );
  wallpaper.addChild(
    new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(AQUA.desktop),
    sprite,
  );
  return wallpaper;
}

export const mac2000Scene: SceneEntry = {
  id: 'mac-2000',
  label: SCENE_CATALOG['mac-2000'].label,
  preload: async (audio) => {
    await preloadMacAssets(audio);
  },
  create: (context) => new Mac2000Scene(context),
};
