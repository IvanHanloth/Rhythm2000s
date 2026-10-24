// 选关：Jaguar Finder 的「我的关卡」窗口（图标视图）+ 右边的「简介」窗口
// （doc/level-select.md、doc/scenes/mac-2000.md「选谱面」）。按原版像素尺寸绘制。
// 单击图标选中，双击或点「简介」里的「开始」开始；「后退」「返回」回到网吧。原点在虚拟屏幕左上角。

import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import type { Chart } from '../../rhythm/chart.ts';
import { formatDuration, summarizeChart } from '../../rhythm/chart-summary.ts';
import { AQUA } from '../../theme/aqua.ts';
import { DoubleClick } from '../../ui/double-click.ts';
import { isMacAction, MAC_ACTIONS, type MacTargetKind } from './action-kinds.ts';
import { appIcon, type AppIconName } from './assets.ts';
import { drawCautionIcon, drawTrashIcon } from './components/icons.ts';
import { aquaText, drawGelPill } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';

/** Finder 窗口和简介窗口在虚拟屏幕上的位置和大小（设计稿换算到 1024×576） */
const FINDER = { x: 56, y: 40, width: 616, height: 445 };
const INFO = { x: 704, y: 74, width: 256, height: 252 };

const TOOLBAR_HEIGHT = 58;
const GRID_PADDING_X = 21;
const GRID_PADDING_Y = 18;
const GRID_COLUMNS = 5;
const CELL_HEIGHT = 100;
const ICON_BOX = 60;
const ICON_SIZE = 48;

/** 「简介」里动作一栏的叫法：按部件种类合并（三种提示框都算「提示框」），免得混音关一长串 */
const KIND_LABELS: Record<MacTargetKind, string> = {
  alert: '提示框',
  dock: 'Dock 弹跳',
  mail: '新邮件',
  window: '最小化窗口',
  // 2026-10-24 起新增的玩家可见文字只用英文
  menu: 'Apple menu',
  file: 'Trash',
};

/** 每种动作代表的图标；混用多种动作的关卡用 iTunes（混音） */
const KIND_ICONS: Record<MacTargetKind, AppIconName | 'caution' | 'trash'> = {
  alert: 'caution',
  dock: 'iChat',
  mail: 'Mail',
  window: 'TextEdit',
  menu: 'System Preferences',
  file: 'trash',
};

export interface MacLevelSelectOptions {
  /** 这台电脑上的全部谱面，按清单顺序 */
  charts: readonly Chart[];
  /** 开始第 index 关（双击图标、「开始」、回车） */
  onStart(index: number): void;
  /** 回到网吧（工具栏「后退」、简介窗口「返回」） */
  onBack(): void;
}

interface IconItem {
  back: Graphics;
  labelBack: Graphics;
  label: Text;
}

export class MacLevelSelect {
  readonly view = new Container({ label: 'level-select' });
  private readonly options: MacLevelSelectOptions;
  private readonly finder: AquaWindow;
  private readonly items: IconItem[] = [];
  private readonly doubleClick = new DoubleClick();
  private info: InfoWindow | null = null;
  private selected = 0;

  constructor(options: MacLevelSelectOptions) {
    this.options = options;
    const { charts } = options;
    this.finder = new AquaWindow({
      title: '我的关卡',
      width: FINDER.width,
      height: FINDER.height,
      content: 'white',
      toolbarHeight: TOOLBAR_HEIGHT,
      statusText: `${charts.length} 项，单击选中，双击开始`,
    });
    this.finder.view.position.set(FINDER.x + FINDER.width / 2, FINDER.y + FINDER.height / 2);
    this.finder.toolbar.addChild(this.toolbar());
    this.finder.content.addChild(this.grid(this.finder.contentWidth));
    this.view.addChild(this.finder.view);
    this.select(0);
  }

  get selectedIndex(): number {
    return this.selected;
  }

  select(index: number): void {
    const count = this.options.charts.length;
    this.selected = Math.min(Math.max(0, count - 1), Math.max(0, index));
    this.items.forEach((item, i) => {
      const on = i === this.selected;
      item.back.visible = on;
      item.labelBack.visible = on;
      item.label.style.fill = on ? AQUA.white : AQUA.ink;
    });
    this.showInfo(this.options.charts[this.selected] ?? null);
  }

  /** 方向键：左右挪一格，上下挪一行 */
  move(dx: number, dy: number): void {
    this.select(this.selected + dx + dy * GRID_COLUMNS);
  }

  /** 每帧传入音频时间，让「开始」按钮呼吸 */
  update(audioTime: number): void {
    this.info?.update(audioTime);
  }

  /** 有提示框盖在上面时两扇窗口都变成非活动 */
  setActive(active: boolean): void {
    this.finder.setActive(active);
    this.info?.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private showInfo(chart: Chart | null): void {
    this.info?.destroy();
    this.info = new InfoWindow(chart, {
      onStart: () => {
        if (chart) this.options.onStart(this.selected);
      },
      onBack: () => this.options.onBack(),
    });
    this.view.addChild(this.info.view);
  }

  // ---------- 图标视图 ----------

  private grid(width: number): Container {
    const grid = new Container({ label: 'icon-grid' });
    const cellWidth = (width - GRID_PADDING_X * 2) / GRID_COLUMNS;
    this.options.charts.forEach((chart, i) => {
      const cell = new Container({ label: `icon-${chart.id}` });
      cell.position.set(
        GRID_PADDING_X + (i % GRID_COLUMNS) * cellWidth,
        GRID_PADDING_Y + Math.floor(i / GRID_COLUMNS) * CELL_HEIGHT,
      );
      const boxX = (cellWidth - ICON_BOX) / 2;
      const back = new Graphics()
        .roundRect(boxX, 0, ICON_BOX, ICON_BOX, 6)
        .fill({ color: AQUA.shadow, alpha: 0.14 });
      const icon = levelIcon(chart, ICON_SIZE);
      icon.position.set((cellWidth - ICON_SIZE) / 2, (ICON_BOX - ICON_SIZE) / 2);

      const label = aquaText(chart.title, { size: 12 });
      label.anchor.set(0.5, 0);
      label.position.set(cellWidth / 2, ICON_BOX + 6);
      const pillWidth = Math.ceil(label.width) + 14;
      const labelBack = new Graphics()
        .roundRect((cellWidth - pillWidth) / 2, ICON_BOX + 5, pillWidth, 17, 8.5)
        .fill(AQUA.selection);

      cell.addChild(back, icon, labelBack, label);
      cell.eventMode = 'static';
      cell.hitArea = new Rectangle(0, 0, cellWidth, ICON_BOX + 26);
      cell.on('pointertap', () => {
        this.select(i);
        if (this.doubleClick.click(chart.id, performance.now())) this.options.onStart(i);
      });
      this.items.push({ back, labelBack, label });
      grid.addChild(cell);
    });
    return grid;
  }

  // ---------- 工具栏 ----------

  private toolbar(): Container {
    const bar = new Container({ label: 'finder-toolbar' });
    let x = 12;
    const add = (icon: Container, iconWidth: number, label: string, onTap?: () => void) => {
      const item = new Container({ label: `toolbar-${label}` });
      const width = Math.max(48, iconWidth + 8);
      icon.position.set((width - iconWidth) / 2, 6);
      const text = aquaText(label, { size: 11 });
      text.anchor.set(0.5, 0);
      text.position.set(width / 2, 40);
      item.addChild(icon, text);
      item.x = x;
      if (onTap) {
        item.eventMode = 'static';
        item.hitArea = new Rectangle(0, 0, width, TOOLBAR_HEIGHT);
        item.on('pointerdown', () => (icon.alpha = 0.6));
        item.on('pointerout', () => (icon.alpha = 1));
        item.on('pointertap', () => {
          icon.alpha = 1;
          onTap();
        });
      }
      bar.addChild(item);
      x += width + 8;
    };
    add(drawBackButton(), 32, '后退', () => this.options.onBack());
    add(drawViewButtons(), 90, '显示');
    add(drawComputerIcon(), 32, '电脑');
    add(drawHomeIcon(), 32, '个人');
    add(drawFolderIcon(), 32, 'rhythm');

    // 右边的搜索框
    const search = new Container({ label: 'search' });
    const field = new Graphics()
      .roundRect(0, 0, 120, 20, 10)
      .fill(AQUA.white)
      .stroke({ width: 1, color: AQUA.separator, alignment: 1 })
      .circle(12, 9.5, 3.5)
      .stroke({ width: 1.4, color: AQUA.inkMuted })
      .moveTo(14.5, 12)
      .lineTo(17.5, 15)
      .stroke({ width: 1.4, color: AQUA.inkMuted });
    const hint = aquaText('搜索', { size: 11, color: AQUA.inkMuted });
    hint.anchor.set(0, 0.5);
    hint.position.set(24, 10);
    search.addChild(field, hint);
    search.position.set(FINDER.width - 120 - 14, 14);
    bar.addChild(search);
    return bar;
  }
}

/** 谱面里用到的部件种类，按第一次出现的顺序 */
function chartKinds(chart: Chart): MacTargetKind[] {
  const actions = summarizeChart(chart).actions.filter(isMacAction);
  return [...new Set(actions.map((a) => MAC_ACTIONS[a].kind))];
}

/** 关卡图标：只用一种部件就用那种部件的图标，混用多种的用 iTunes */
function levelIcon(chart: Chart, size: number): Container {
  const kinds = chartKinds(chart);
  const only = kinds.length === 1 ? kinds[0]! : null;
  const name = only ? KIND_ICONS[only] : 'iTunes';
  if (name === 'caution') return drawCautionIcon(size);
  if (name === 'trash') return drawTrashIcon(size, { full: true });
  return appIcon(name, size);
}

// ---------- 简介窗口 ----------

/** 「显示简介」窗口：大图标、名字，「一般信息」里列动作、速度、乐句、时长，右下「返回」「开始」 */
class InfoWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly buttons: PushButton[] = [];

  constructor(chart: Chart | null, handlers: { onStart: () => void; onBack: () => void }) {
    const name = chart?.title ?? '没有关卡';
    this.window = new AquaWindow({
      title: `${name} 简介`,
      width: INFO.width,
      height: INFO.height,
      toolbarButton: false,
      growBox: false,
    });
    this.view = this.window.view;
    this.view.position.set(INFO.x + INFO.width / 2, INFO.y + INFO.height / 2);
    const content = this.window.content;

    if (chart) content.addChild(levelIcon(chart, 48)).position.set(14, 12);
    const title = aquaText(name, { size: 14, bold: true });
    title.position.set(72, 16);
    const kind = aquaText('rhythm2000s 关卡', { size: 11, color: AQUA.inkSoft });
    kind.position.set(72, 36);
    content.addChild(title, kind);

    const disclosure = aquaText('▾ 一般信息：', { size: 12 });
    disclosure.position.set(14, 72);
    content.addChild(disclosure);

    const rows: [string, string][] = chart
      ? (() => {
          const summary = summarizeChart(chart);
          return [
            [
              '动作：',
              chartKinds(chart)
                .map((k) => KIND_LABELS[k])
                .join('、'),
            ],
            ['速度：', `${chart.bpm} BPM`],
            ['乐句：', `${summary.phrases} 句`],
            ['时长：', formatDuration(summary.seconds)],
          ];
        })()
      : [['', '这台电脑上还没有可玩的关卡。']];
    // 一行字太长会换行，所以按实际高度往下排，最后再画外框
    const groupTop = 92;
    const group = new Graphics();
    content.addChild(group);
    let y = groupTop + 6;
    for (const [label, value] of rows) {
      const key = aquaText(label, { size: 11, color: AQUA.inkSoft });
      key.anchor.set(1, 0);
      key.position.set(70, y);
      const text = aquaText(value, { size: 11, wrapWidth: INFO.width - 94, lineHeight: 15 });
      text.position.set(74, y);
      content.addChild(key, text);
      y += Math.max(16, Math.ceil(text.height) + 1);
    }
    group
      .roundRect(10, groupTop, INFO.width - 20, y - groupTop + 5, 4)
      .fill({ color: AQUA.white, alpha: 0.35 })
      .stroke({ width: 1, color: AQUA.separator, alpha: 0.8 });

    // 右下角的按钮，默认按钮在最右
    const contentHeight = INFO.height - TITLE_BAR_HEIGHT;
    const buttonTop = contentHeight - PUSH_BUTTON_HEIGHT - 14;
    const back = new PushButton({ label: '返回' });
    const start = new PushButton({ label: '开始', isDefault: chart !== null });
    let right = INFO.width - 14;
    for (const [button, onTap] of [
      [start, handlers.onStart],
      [back, handlers.onBack],
    ] as const) {
      right -= button.width;
      button.view.position.set(right, buttonTop);
      right -= 12;
      button.view.eventMode = 'static';
      button.view.on('pointerdown', () => (button.view.alpha = 0.75));
      button.view.on('pointerout', () => (button.view.alpha = 1));
      button.view.on('pointertap', () => {
        button.view.alpha = 1;
        onTap();
      });
      this.buttons.push(button);
      content.addChild(button.view);
    }
    if (!chart) start.view.alpha = 0.5;
  }

  update(audioTime: number): void {
    for (const button of this.buttons) button.update(audioTime);
  }

  setActive(active: boolean): void {
    this.window.setActive(active);
    for (const button of this.buttons) button.setActive(active);
  }

  destroy(): void {
    this.window.destroy();
  }
}

// ---------- 工具栏图标（本地没有原版图标，按原版样子矢量绘制） ----------

/** 后退：白色果冻方块里一个向左的箭头 */
function drawBackButton(): Graphics {
  return drawGelPill(new Graphics(), 0, 2, 32, 26, AQUA.gel.white)
    .moveTo(19, 9)
    .lineTo(13, 15)
    .lineTo(19, 21)
    .stroke({ width: 2, color: AQUA.inkSoft, cap: 'round', join: 'round' });
}

/** 显示方式：图标（选中，蓝色）、列表、分栏三段 */
function drawViewButtons(): Container {
  const root = new Container();
  root.addChild(
    drawGelPill(new Graphics(), 0, 2, 32, 26, AQUA.gel.blue),
    drawGelPill(new Graphics(), 29, 2, 32, 26, AQUA.gel.white),
    drawGelPill(new Graphics(), 58, 2, 32, 26, AQUA.gel.white),
  );
  const g = new Graphics();
  for (const [x, y] of [
    [10, 9],
    [17, 9],
    [10, 16],
    [17, 16],
  ] as const) {
    g.rect(x, y, 5, 5).fill(AQUA.white);
  }
  for (const y of [10, 15, 20]) g.moveTo(38, y).lineTo(52, y);
  g.stroke({ width: 1.6, color: AQUA.inkSoft });
  g.rect(67.5, 9.5, 14, 12)
    .moveTo(72.5, 9.5)
    .lineTo(72.5, 21.5)
    .moveTo(77, 9.5)
    .lineTo(77, 21.5)
    .stroke({ width: 1.2, color: AQUA.inkSoft });
  root.addChild(g);
  return root;
}

/** 电脑：灰色显示器，蓝屏 */
function drawComputerIcon(): Graphics {
  return new Graphics()
    .roundRect(3, 3, 26, 19, 2)
    .fill('#e8e8e8')
    .stroke({ width: 1, color: '#666666' })
    .rect(5, 5, 22, 14)
    .fill('#3b7fd4')
    .poly([11, 29, 21, 29, 20, 22, 12, 22])
    .fill('#cfcfcf')
    .stroke({ width: 1, color: '#666666' });
}

/** 个人：红屋顶的小房子 */
function drawHomeIcon(): Graphics {
  return new Graphics()
    .poly([4, 16, 16, 5, 28, 16, 28, 29, 4, 29])
    .fill('#f2f2f2')
    .stroke({ width: 1, color: '#666666' })
    .rect(13, 19, 6, 10)
    .fill('#b07b3c')
    .moveTo(2, 17)
    .lineTo(16, 4)
    .lineTo(30, 17)
    .stroke({ width: 2.4, color: '#b5261b', join: 'round' });
}

/** 关卡文件夹：Aqua 的蓝色文件夹 */
function drawFolderIcon(): Graphics {
  return new Graphics()
    .poly([3, 8, 13, 8, 16, 11, 29, 11, 29, 28, 3, 28])
    .fill('#8fb9ec')
    .stroke({ width: 1, color: '#3b6db3' })
    .rect(3, 14, 26, 14)
    .fill('#a9cbf3')
    .stroke({ width: 1, color: '#3b6db3' })
    .moveTo(14, 25)
    .lineTo(14, 18)
    .lineTo(21, 16.5)
    .lineTo(21, 23)
    .stroke({ width: 1.4, color: '#234e8c' });
}
