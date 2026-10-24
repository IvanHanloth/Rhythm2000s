// 场景：2000 年前后的 Mac 桌面（doc/scenes/mac-2000.md），按简体中文版 Mac OS X 10.0–10.2 的早期 Aqua 还原。
// 玩法与 XP 的 MVP 相同：示范小节里电脑按节奏「出事」，跟打小节里玩家按同样的节奏逐个处理。
// Aqua 界面按原版像素尺寸画在 1024×576 的虚拟屏幕上，整体放大 1.25 倍铺满画布；轮次横幅和判定字样按画布坐标画。
// 画面每帧只根据音频时间计算，不累加帧间隔。

import { Container, Graphics, Sprite } from 'pixi.js';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../game/layout.ts';
import type { FrameInfo, Scene, SceneContext, SceneEntry, TapInfo } from '../../game/scene.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { buildTurnCues, turnCueAt, type TurnCue } from '../../rhythm/turn-cue.ts';
import { AQUA } from '../../theme/aqua.ts';
import { BEATS, THEMES } from '../../theme/tokens.ts';
import { clamp01 } from '../../ui/easing.ts';
import { TurnBanner } from '../../ui/turn-banner.ts';
import { SCENE_CATALOG } from '../catalog.ts';
import { isMacAction, MAC_ACTIONS, type MacTargetKind } from './action-kinds.ts';
import { appIcon, macAssets, preloadMacAssets, type AppIconName } from './assets.ts';
import { AquaAlert, type AquaAlertOptions } from './components/alert.ts';
import { Dock, DOCK_HEIGHT, type DockItem } from './components/dock.ts';
import { drawCautionIcon, drawFinderIcon } from './components/icons.ts';
import { AquaListView, LIST_ROW_HEIGHT, type ListRow } from './components/list-view.ts';
import { MenuBar } from './components/menu-bar.ts';
import { AquaWindow, STATUS_BAR_HEIGHT, TITLE_BAR_HEIGHT } from './components/window.ts';
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

/** 谱面列表里「动作」一列的叫法，以及每种动作代表的小图标 */
const KIND_LABELS: Record<MacTargetKind, string> = {
  alert: '提示框',
  dock: 'Dock 弹跳',
  mail: '新邮件',
  window: '最小化',
};
const KIND_ICONS: Record<MacTargetKind, AppIconName | 'caution'> = {
  alert: 'caution',
  dock: 'iChat',
  mail: 'Mail',
  window: 'TextEdit',
};

const PICKER = { x: 512, y: 250, width: 520, height: 260 };
/** 结果出来后多久才接受「再来一次」的输入（毫秒），避免连按误触 */
const RESULT_INPUT_DELAY_MS = 600;

/**
 * select：在谱面列表里挑谱面；starting：等音频恢复；playing：一局进行中；
 * result：显示结果；unavailable：没有可用的谱面
 */
type State = 'select' | 'starting' | 'playing' | 'result' | 'unavailable';

class Mac2000Scene implements Scene {
  readonly view = new Container({ label: 'mac-2000' });
  private readonly context: SceneContext;
  private readonly charts: Chart[];
  private readonly sounds: MacSongSounds;
  private readonly turnBanner = new TurnBanner({
    call: { fill: theme.surfaceRaised, text: theme.ink, line: theme.line },
    response: { fill: theme.accent, text: theme.onAccent, line: theme.highlight },
  });
  private readonly screen = new Container({ label: 'mac-screen' });
  private readonly menuBar = new MenuBar({ width: SCREEN_WIDTH, appName: 'Finder', menus: MENUS });
  private readonly dock = new Dock(DOCK_ITEMS);
  private readonly windowLayer = new Container({ label: 'windows' });
  private readonly dialogLayer = new Container({ label: 'dialogs' });
  private readonly judgementLayer = new Container({ label: 'judgements' });
  private readonly picker: AquaWindow;
  private readonly list: AquaListView | null;
  /** 场景自己的音效出口（结果音）；一局里的声音走 MacSession 的出口 */
  private readonly output: GainNode;

  private state: State = 'select';
  private selected = 0;
  private turnCues: TurnCue[] = [];
  private session: MacSession | null = null;
  private targetsView: MacTargetsView | null = null;
  private dialog: AquaAlert | null = null;
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

    const picker = createPicker(this.charts);
    this.picker = picker.window;
    this.list = picker.list;
    this.picker.view.position.set(PICKER.x, PICKER.y);

    this.screen.scale.set(SCREEN_SCALE);
    this.screen.addChild(
      createWallpaper(),
      this.picker.view,
      this.windowLayer,
      this.dialogLayer,
      this.dock.view,
      this.menuBar.view,
    );
    this.turnBanner.view.position.set(DESIGN_WIDTH / 2, BANNER_Y);
    this.view.addChild(this.screen, this.judgementLayer, this.turnBanner.view);

    if (this.charts.length > 0) {
      this.select(0);
    } else {
      this.state = 'unavailable';
      this.showDialog({
        icon: drawCautionIcon(64),
        message: '没有可用的谱面。',
        informative: '谱面没有加载成功，原因见浏览器控制台。谱面文件放在 public/charts/ 目录下。',
        buttons: [{ label: '好', isDefault: true }],
      });
    }

    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update({ audioTime }: FrameInfo): void {
    // 菜单栏时钟只是装饰，显示本机时间，不参与节奏
    this.menuBar.update(new Date());
    this.dialog?.update(audioTime);

    const session = this.session;
    if (this.state !== 'playing' || !session) return;
    session.update(audioTime);
    this.targetsView?.update(audioTime);
    this.renderTurnBanner(session.beatAt(audioTime));
    if (audioTime >= session.endTime) this.finish(session);
  }

  onTap({ audioTime }: TapInfo): void {
    switch (this.state) {
      case 'select':
        void this.start();
        break;
      case 'playing':
        this.session?.tap(audioTime);
        break;
      case 'result':
        if (performance.now() - this.resultShownAt >= RESULT_INPUT_DELAY_MS) void this.start();
        break;
      case 'starting':
      case 'unavailable':
        break;
    }
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

  /** ↑ ↓ 选谱面；结果出来后按 ↑ ↓ 回到谱面列表（Esc 留给全局的「回到街区」） */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    const step = event.code === 'ArrowUp' ? -1 : event.code === 'ArrowDown' ? 1 : 0;
    if (this.state === 'result' && step !== 0) {
      event.preventDefault();
      this.backToList();
      return;
    }
    if (this.state === 'select' && step !== 0) {
      event.preventDefault();
      this.select(this.selected + step);
    }
  };

  private select(index: number): void {
    this.selected = Math.min(this.charts.length - 1, Math.max(0, index));
    this.list?.setSelected(this.selected);
  }

  private backToList(): void {
    this.clearRound();
    this.hideDialog();
    this.picker.view.visible = true;
    this.picker.setActive(true);
    this.state = 'select';
  }

  private async start(): Promise<void> {
    const chart = this.charts[this.selected];
    if (!chart) return;
    this.state = 'starting';
    await this.context.clock.resume();
    // 等待音频恢复期间可能已经离开场景
    if (this.destroyed || this.state !== 'starting') return;

    this.clearRound();
    this.hideDialog();
    this.picker.view.visible = false;
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

  private finish(session: MacSession): void {
    const { perfect, good, miss } = session.counts();
    const title = session.chart.title;
    this.clearRound();
    this.state = 'result';
    this.resultShownAt = performance.now();
    this.picker.view.visible = false;
    this.showDialog({
      icon: drawFinderIcon(64),
      message: `「${title}」完成。`,
      informative: `Perfect ${perfect}　　Good ${good}　　Miss ${miss}\n\n按空格键或点击画面再来一次，按 ↑ ↓ 回到谱面列表。`,
      buttons: [{ label: '谱面列表' }, { label: '再来一次', isDefault: true }],
    });
    this.playNow(this.sounds.result);
  }

  /** 切到后台时浏览器会降频，计时不再可靠，直接中止这一局，回到谱面列表 */
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

  private showDialog(options: AquaAlertOptions): void {
    this.hideDialog();
    this.picker.setActive(false);
    this.dialog = new AquaAlert({ width: 400, ...options });
    this.dialog.view.position.set(SCREEN_WIDTH / 2, PICKER.y);
    this.dialogLayer.addChild(this.dialog.view);
  }

  private hideDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
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

/** 谱面里用到的动作种类，按第一次出现的顺序 */
function chartKinds(chart: Chart): MacTargetKind[] {
  const kinds = chart.calls.map((c) => (isMacAction(c.action) ? MAC_ACTIONS[c.action].kind : null));
  return [...new Set(kinds.filter((k): k is MacTargetKind => k !== null))];
}

/** Finder 列表视图窗口：列出全部 Mac 谱面 */
function createPicker(charts: readonly Chart[]): {
  window: AquaWindow;
  list: AquaListView | null;
} {
  const contentHeight = PICKER.height - TITLE_BAR_HEIGHT - STATUS_BAR_HEIGHT;
  const window = new AquaWindow({
    title: '节奏谱面',
    width: PICKER.width,
    height: PICKER.height,
    content: 'white',
    statusText:
      charts.length > 0 ? `${charts.length} 项 — 按 ↑ ↓ 选择，按空格键或点击画面开始` : '0 项',
    scroller: {
      thumbStart: 0,
      thumbSize: Math.min(1, contentHeight / (17 + charts.length * LIST_ROW_HEIGHT)),
    },
  });
  if (charts.length === 0) return { window, list: null };

  const rows: ListRow[] = charts.map((chart) => {
    const kinds = chartKinds(chart);
    const iconName = kinds.length === 1 ? KIND_ICONS[kinds[0]!] : 'iTunes';
    return {
      cells: [chart.title, `${chart.bpm}`, kinds.map((k) => KIND_LABELS[k]).join('、')],
      icon: iconName === 'caution' ? drawCautionIcon(16) : appIcon(iconName, 16),
    };
  });
  const list = new AquaListView(
    [
      { title: '名称', width: 220 },
      { title: '速度', width: 60, align: 'right' },
      { title: '动作', width: window.contentWidth - 280 },
    ],
    rows,
  );
  window.content.addChild(list.view);
  return { window, list };
}

export const mac2000Scene: SceneEntry = {
  id: 'mac-2000',
  label: SCENE_CATALOG['mac-2000'].label,
  preload: async (audio) => {
    await preloadMacAssets(audio);
  },
  create: (context) => new Mac2000Scene(context),
};
