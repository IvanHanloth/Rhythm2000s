// 场景：2000 年前后的 Mac 桌面（doc/scenes/mac-2000.md），按简体中文版 Mac OS X 10.0–10.2 的早期 Aqua 还原。
// 玩法与 XP 的 MVP 相同：示范小节里电脑按节奏「出事」，跟打小节里玩家按同样的节奏逐个处理。
// 进场景先在 Finder 里用鼠标选关（doc/level-select.md）。
// Aqua 界面按原版像素尺寸画在 1024×576 的虚拟屏幕上，整体放大 1.25 倍铺满画布；轮次横幅和判定字样按画布坐标画。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container, Graphics, Sprite } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import { recordScore } from '../../game/records.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { summarizeResult } from '../../rhythm/result-summary.ts';
import { buildTurnCues, turnCueAt, type TurnCue } from '../../rhythm/turn-cue.ts';
import { AQUA } from '../../theme/aqua.ts';
import { BEATS, THEMES } from '../../theme/tokens.ts';
import { clamp01 } from '../../ui/easing.ts';
import { TurnBanner } from '../../ui/turn-banner.ts';
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

const theme = THEMES.aqua;
const SCREEN_SCALE = 1.25;
const SCREEN_WIDTH = DESIGN_WIDTH / SCREEN_SCALE;
const SCREEN_HEIGHT = DESIGN_HEIGHT / SCREEN_SCALE;

/** 轮次横幅中心的纵坐标（画布坐标），在菜单栏下方、最上排提示框之上 */
const BANNER_Y = 62;

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
 * select：Finder 里选关；starting：等音频恢复；playing：一局进行中；result：显示结果。
 * 选关和结果时点画面不算节奏输入（onTap 不处理），只认鼠标点到的按钮、图标和键盘。
 */
type State = 'select' | 'starting' | 'playing' | 'result';

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
  private readonly screen = new Container({ label: 'mac-screen' });
  private readonly menuBar = new MenuBar({ width: SCREEN_WIDTH, appName: 'Finder', menus: MENUS });
  private readonly dock = new Dock(DOCK_ITEMS);
  private readonly levelSelect: MacLevelSelect;
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  /** 场景自己的音效出口（结果音）；一局里的声音走 MacSession 的出口 */
  private readonly output: GainNode;

  private state: State = 'select';
  private chart: Chart | null = null;
  private turnCues: TurnCue[] = [];
  private session: MacSession | null = null;
  private targetsView: MacTargetsView | null = null;
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
      this.menuBar.view,
    );
    this.turnBanner.view.position.set(DESIGN_WIDTH / 2, BANNER_Y);
    this.view.addChild(this.screen, this.judgementLayer, this.turnBanner.view);

    if (this.charts.length === 0) {
      this.showDialog({
        icon: drawCautionIcon(64),
        message: '没有可用的谱面。',
        informative: '谱面没有加载成功，原因见浏览器控制台。谱面文件放在 public/charts/ 目录下。',
        buttons: [{ label: '好', isDefault: true, onTap: () => this.hideDialog() }],
      });
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
    this.renderTurnBanner(session.beatAt(audioTime));
    if (audioTime >= session.endTime) this.finish(session);
  }

  /** 只有一局进行中时，空格和点画面才是节奏输入 */
  onTap({ audioTime }: TapInfo): void {
    if (this.state === 'playing') this.session?.tap(audioTime);
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
    void this.start(chart);
  }

  private retry(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    if (this.chart) void this.start(this.chart);
  }

  private backToList(): void {
    this.clearRound();
    this.state = 'select';
    this.hideDialog();
    this.levelSelect.view.visible = true;
    this.levelSelect.setActive(true);
  }

  private async start(chart: Chart): Promise<void> {
    this.state = 'starting';
    this.chart = chart;
    await this.context.clock.resume();
    // 等待音频恢复期间可能已经离开场景，或按了 Esc
    if (this.destroyed || this.state !== 'starting') return;

    this.clearRound();
    this.hideDialog();
    this.levelSelect.view.visible = false;
    this.turnCues = buildTurnCues(chart);
    this.session = new MacSession(this.context, chart, this.sounds);
    this.targetsView = new MacTargetsView(this.session, {
      windowLayer: this.windowLayer,
      judgementLayer: this.judgementLayer,
      dock: this.dock,
      screenScale: SCREEN_SCALE,
    });
    this.state = 'playing';
  }

  /** 结算后直接玩列表里的下一关，Finder 里的选中也跟过去 */
  private next(): void {
    if (performance.now() - this.resultShownAt < RESULT_INPUT_DELAY_MS) return;
    const index = this.chart ? this.charts.indexOf(this.chart) + 1 : -1;
    const chart = this.charts[index];
    if (!chart) return;
    this.levelSelect.select(index);
    void this.start(chart);
  }

  /** 一局结束：弹出结算窗口（doc/results.md），记下最好得分 */
  private finish(session: MacSession): void {
    const chart = session.chart;
    const summary = summarizeResult(
      session.judgements.map((j) => ({
        level: j.level,
        offset: j.offset,
        phrase: session.targets[j.target]?.call.phrase ?? 0,
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
    this.turnCues = [];
    this.turnBanner.show(null);
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
