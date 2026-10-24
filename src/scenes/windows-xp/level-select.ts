// 选关：XP 资源管理器（CabinetWClass）里的「My Levels」文件夹（doc/level-select.md、doc/scenes/windows-xp.md「选关」）。
// 菜单栏、标准按钮工具栏、地址栏、左边任务窗格、右边平铺视图、底部状态栏，按原版像素尺寸绘制。
// 单击图标选中，双击或点任务窗格的「Play this level」开始；工具栏「Back」回到网吧。原点在窗口左上角。

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { ACTION_LABELS } from '../../rhythm/actions.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { formatDuration, summarizeChart } from '../../rhythm/chart-summary.ts';
import { LUNA } from '../../theme/xp-luna.ts';
import { DoubleClick } from '../../ui/double-click.ts';
import { xpAssets } from './assets.ts';
import {
  edgeRing,
  horizontalGradient,
  topRoundedRect,
  verticalGradient,
} from './components/draw.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { xpText } from './components/xp-text.ts';
import { DIALOG_KINDS, isDialogKind } from './dialog-kinds.ts';

export const EXPLORER_TITLE = 'My Levels';
const ADDRESS = 'C:\\Rhythm 2000s\\My Levels\\XP Desktop';

const MENU_HEIGHT = 20;
const TOOLBAR_HEIGHT = 38;
const ADDRESS_HEIGHT = 24;
const STATUS_HEIGHT = 20;
const TASK_PANE_WIDTH = 200;
const GROUP_MARGIN = 12;
const GROUP_HEADER_HEIGHT = 25;
const LINK_HEIGHT = 20;
/** 平铺视图 */
const VIEW_PADDING_X = 18;
const VIEW_PADDING_Y = 14;
const TILE_COLUMNS = 3;
const TILE_HEIGHT = 56;
const TILE_GAP_X = 18;
const TILE_GAP_Y = 10;
const TILE_ICON = 48;

const MENUS = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'];

export interface XpLevelSelectOptions {
  /** 这台电脑上的全部谱面，按清单顺序 */
  charts: readonly Chart[];
  width: number;
  height: number;
  /** 开始第 index 关（双击图标、「Play this level」、回车） */
  onStart(index: number): void;
  /** 回到网吧（工具栏「Back」、任务窗格「Back to the café」） */
  onBack(): void;
}

interface Tile {
  view: Container;
  icon: Sprite;
  labelBack: Graphics;
  label: Text;
}

export class XpLevelSelect {
  readonly view = new Container({ label: 'level-select' });
  readonly frame: XpWindowFrame;
  private readonly options: XpLevelSelectOptions;
  private readonly tiles: Tile[] = [];
  private readonly details = new Container({ label: 'details' });
  private readonly doubleClick = new DoubleClick();
  private selected = 0;

  constructor(options: XpLevelSelectOptions) {
    this.options = options;
    const { width, height, charts } = options;
    this.frame = new XpWindowFrame({
      title: EXPLORER_TITLE,
      width,
      height,
      icon: 'folder-open',
      controls: 'all',
    });

    const clientWidth = width - FRAME_WIDTH * 2;
    const clientHeight = height - CAPTION_HEIGHT - FRAME_WIDTH;
    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);

    const bodyTop = MENU_HEIGHT + TOOLBAR_HEIGHT + ADDRESS_HEIGHT;
    const bodyHeight = clientHeight - bodyTop - STATUS_HEIGHT;

    const view = this.tileView(clientWidth - TASK_PANE_WIDTH, bodyHeight);
    view.position.set(TASK_PANE_WIDTH, bodyTop);
    const pane = this.taskPane(bodyHeight);
    pane.position.set(0, bodyTop);

    const status = statusBar(
      clientWidth,
      `${charts.length} ${charts.length === 1 ? 'object' : 'objects'}`,
      'Click to select, double-click to play    Esc: back to the café',
    );
    status.y = clientHeight - STATUS_HEIGHT;

    client.addChild(
      menuBar(clientWidth),
      this.toolbar(clientWidth),
      addressBar(clientWidth),
      pane,
      view,
      status,
    );
    this.view.addChild(this.frame.view, client);
    this.select(0);
  }

  get selectedIndex(): number {
    return this.selected;
  }

  /** 选中第 index 关，刷新图标高亮和「Details」 */
  select(index: number): void {
    const count = this.options.charts.length;
    if (count === 0) {
      this.renderDetails(null);
      return;
    }
    this.selected = Math.min(count - 1, Math.max(0, index));
    this.tiles.forEach((tile, i) => {
      const on = i === this.selected;
      tile.icon.tint = on ? LUNA.explorer.selectedIconTint : '#ffffff';
      tile.labelBack.visible = on;
      tile.label.style.fill = on ? LUNA.white : LUNA.ink;
    });
    this.renderDetails(this.options.charts[this.selected]!);
  }

  /** 方向键：左右挪一格，上下挪一行 */
  move(dx: number, dy: number): void {
    this.select(this.selected + dx + dy * TILE_COLUMNS);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  // ---------- 平铺视图 ----------

  private tileView(width: number, height: number): Container {
    const root = new Container({ label: 'tiles' });
    root.addChild(new Graphics().rect(0, 0, width, height).fill(LUNA.white));
    const { charts } = this.options;
    if (charts.length === 0) return root;

    const title = xpText('All Levels', { fontWeight: '700', fill: LUNA.explorer.viewGroupTitle });
    title.position.set(VIEW_PADDING_X, VIEW_PADDING_Y);
    const line = new Graphics()
      .rect(VIEW_PADDING_X, VIEW_PADDING_Y + 18, width - VIEW_PADDING_X * 2, 1)
      .fill(horizontalGradient(LUNA.explorer.viewGroupLine));
    root.addChild(title, line);

    const tileWidth = (width - VIEW_PADDING_X * 2 - TILE_GAP_X * (TILE_COLUMNS - 1)) / TILE_COLUMNS;
    const top = VIEW_PADDING_Y + 28;
    charts.forEach((chart, i) => {
      const tile = this.tile(chart, i, tileWidth);
      tile.view.position.set(
        VIEW_PADDING_X + (i % TILE_COLUMNS) * (tileWidth + TILE_GAP_X),
        top + Math.floor(i / TILE_COLUMNS) * (TILE_HEIGHT + TILE_GAP_Y),
      );
      this.tiles.push(tile);
      root.addChild(tile.view);
    });
    return root;
  }

  private tile(chart: Chart, index: number, width: number): Tile {
    const summary = summarizeChart(chart);
    const view = new Container({ label: `tile-${chart.id}` });
    const icon = new Sprite(xpAssets().icon(levelIcon(summary.actions)));
    icon.setSize(TILE_ICON);
    icon.position.set(3, (TILE_HEIGHT - TILE_ICON) / 2);

    const textX = TILE_ICON + 11;
    const label = xpText(chart.title);
    label.position.set(textX + 2, 6);
    const labelBack = new Graphics()
      .rect(textX, 5, Math.ceil(label.width) + 4, 16)
      .fill(LUNA.selection);
    labelBack.visible = false;
    const sub1 = xpText(actionText(summary.actions), { fill: LUNA.explorer.subText });
    sub1.position.set(textX + 2, 22);
    const sub2 = xpText(`${chart.bpm} BPM · ${formatDuration(summary.seconds)}`, {
      fill: LUNA.explorer.subText,
    });
    sub2.position.set(textX + 2, 37);

    view.addChild(icon, labelBack, label, sub1, sub2);
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, TILE_HEIGHT);
    view.on('pointertap', () => {
      this.select(index);
      if (this.doubleClick.click(chart.id, performance.now())) this.options.onStart(index);
    });
    return { view, icon, labelBack, label };
  }

  // ---------- 任务窗格 ----------

  private taskPane(height: number): Container {
    const pane = new Container({ label: 'task-pane' });
    pane.addChild(
      new Graphics()
        .rect(0, 0, TASK_PANE_WIDTH, height)
        .fill(verticalGradient(LUNA.explorer.taskPane)),
    );

    const tasks = taskGroup('Level Tasks', [
      { icon: drawPlayIcon(), label: 'Play this level', onTap: () => this.startSelected() },
      { icon: drawBackIcon(16), label: 'Back to the café', onTap: () => this.options.onBack() },
    ]);
    tasks.view.position.set(GROUP_MARGIN, GROUP_MARGIN);

    const detailsHeight = 112;
    const details = taskGroupFrame('Details', detailsHeight);
    details.position.set(GROUP_MARGIN, GROUP_MARGIN + tasks.height + GROUP_MARGIN);
    this.details.position.set(10, GROUP_HEADER_HEIGHT + 8);
    details.addChild(this.details);

    pane.addChild(tasks.view, details);
    return pane;
  }

  private startSelected(): void {
    if (this.options.charts.length > 0) this.options.onStart(this.selected);
  }

  private renderDetails(chart: Chart | null): void {
    for (const child of this.details.removeChildren()) child.destroy();
    const wrap = TASK_PANE_WIDTH - GROUP_MARGIN * 2 - 20;
    if (!chart) {
      this.details.addChild(
        xpText('There are no levels on this computer yet.', {
          wordWrap: true,
          wordWrapWidth: wrap,
        }),
      );
      return;
    }
    const summary = summarizeChart(chart);
    const name = xpText(chart.title, { fontWeight: '700' });
    const lines = xpText(
      [
        `Actions: ${summary.actions.map((a) => ACTION_LABELS[a]).join(', ')}`,
        `Tempo: ${chart.bpm} BPM`,
        `Phrases: ${summary.phrases}`,
        `Length: ${formatDuration(summary.seconds)}`,
      ].join('\n'),
      { wordWrap: true, wordWrapWidth: wrap, breakWords: true, lineHeight: 17 },
    );
    lines.y = 20;
    this.details.addChild(name, lines);
  }

  // ---------- 工具栏 ----------

  private toolbar(width: number): Container {
    const bar = new Container({ label: 'toolbar' });
    bar.y = MENU_HEIGHT;
    const e = LUNA.explorer;
    bar.addChild(
      new Graphics()
        .rect(0, 0, width, TOOLBAR_HEIGHT)
        .fill(LUNA.face)
        .rect(0, 0, width, 1)
        .fill(e.bandLight)
        .rect(0, TOOLBAR_HEIGHT - 1, width, 1)
        .fill(e.bandDark),
    );

    let x = 4;
    const add = (button: Container, w: number) => {
      button.position.set(x, 3);
      bar.addChild(button);
      x += w;
    };
    const separator = () => {
      bar.addChild(
        new Graphics()
          .rect(x + 3, 6, 1, TOOLBAR_HEIGHT - 12)
          .fill(e.toolbarSeparator)
          .rect(x + 4, 6, 1, TOOLBAR_HEIGHT - 12)
          .fill(e.bandLight),
      );
      x += 8;
    };

    const back = toolbarButton(drawBackIcon(26), 'Back', true, () => this.options.onBack());
    add(back.view, back.width + 2);
    const forward = toolbarButton(drawForwardIcon(), '', true, null);
    add(forward.view, forward.width + 2);
    const up = toolbarButton(drawUpIcon(), '', false, null);
    add(up.view, up.width);
    separator();
    const search = toolbarButton(iconSprite('search', 24), 'Search', false, null);
    add(search.view, search.width);
    const folders = toolbarButton(iconSprite('folder-open', 24), 'Folders', false, null);
    add(folders.view, folders.width);
    separator();
    const views = toolbarButton(drawViewsIcon(), '', true, null);
    add(views.view, views.width);
    return bar;
  }
}

/** 关卡图标：只用一种消息框就用那种消息框的图标，混用多种的用程序窗口图标 */
function levelIcon(actions: readonly string[]): string {
  const only = actions.length === 1 ? actions[0]! : null;
  return only && isDialogKind(only) ? DIALOG_KINDS[only].icon : 'program-window';
}

function actionText(actions: readonly (keyof typeof ACTION_LABELS)[]): string {
  return actions.length === 1 ? ACTION_LABELS[actions[0]!] : `${actions.length} action types`;
}

function iconSprite(name: string, size: number): Sprite {
  const sprite = new Sprite(xpAssets().icon(name));
  sprite.setSize(size);
  return sprite;
}

// ---------- 菜单栏、地址栏、状态栏 ----------

function menuBar(width: number): Container {
  const bar = new Container({ label: 'menu-bar' });
  bar.addChild(new Graphics().rect(0, 0, width, MENU_HEIGHT).fill(LUNA.face));
  let x = 2;
  for (const item of MENUS) {
    const text = xpText(item);
    text.anchor.set(0, 0.5);
    text.position.set(x + 7, MENU_HEIGHT / 2);
    bar.addChild(text);
    x += Math.ceil(text.width) + 14;
  }
  return bar;
}

function addressBar(width: number): Container {
  const e = LUNA.explorer;
  const bar = new Container({ label: 'address-bar' });
  bar.y = MENU_HEIGHT + TOOLBAR_HEIGHT;
  bar.addChild(
    new Graphics()
      .rect(0, 0, width, ADDRESS_HEIGHT)
      .fill(LUNA.face)
      .rect(0, ADDRESS_HEIGHT - 1, width, 1)
      .fill(e.bandDark),
  );

  const label = xpText('Address', { fill: e.addressLabel });
  label.anchor.set(0, 0.5);
  label.position.set(6, ADDRESS_HEIGHT / 2);

  const comboLeft = 58;
  const goWidth = 56;
  const comboWidth = width - comboLeft - goWidth - 8;
  const comboTop = 2;
  const comboHeight = ADDRESS_HEIGHT - 5;
  const combo = new Graphics()
    .rect(comboLeft, comboTop, comboWidth, comboHeight)
    .fill(e.comboBorder)
    .rect(comboLeft + 1, comboTop + 1, comboWidth - 2, comboHeight - 2)
    .fill(LUNA.white);
  // 右端的下拉按钮
  const buttonX = comboLeft + comboWidth - 18;
  combo
    .roundRect(buttonX, comboTop + 1, 17, comboHeight - 2, 2)
    .fill(e.comboButtonEdge)
    .roundRect(buttonX + 1, comboTop + 2, 15, comboHeight - 4, 1)
    .fill(verticalGradient(e.comboButton))
    .poly([buttonX + 5, 9, buttonX + 12, 9, buttonX + 8.5, 13])
    .fill(e.comboArrow);

  const folder = iconSprite('folder-open', 16);
  folder.position.set(comboLeft + 4, comboTop + 2);
  const path = xpText(ADDRESS);
  path.anchor.set(0, 0.5);
  path.position.set(comboLeft + 24, ADDRESS_HEIGHT / 2);

  const go = new Graphics()
    .roundRect(0, 0, 18, 18, 3)
    .fill(e.go)
    .stroke({ width: 1, color: e.goEdge, alignment: 1 })
    .moveTo(4.5, 9)
    .lineTo(12.5, 9)
    .moveTo(9.5, 5.5)
    .lineTo(13, 9)
    .lineTo(9.5, 12.5)
    .stroke({ width: 2, color: LUNA.white });
  go.position.set(width - goWidth, (ADDRESS_HEIGHT - 18) / 2);
  const goText = xpText('Go');
  goText.anchor.set(0, 0.5);
  goText.position.set(width - goWidth + 22, ADDRESS_HEIGHT / 2);

  bar.addChild(label, combo, folder, path, go, goText);
  return bar;
}

function statusBar(width: number, left: string, right: string): Container {
  const e = LUNA.explorer;
  const bar = new Container({ label: 'status-bar' });
  const split = Math.round(width * 0.62);
  const g = new Graphics()
    .rect(0, 0, width, STATUS_HEIGHT)
    .fill(LUNA.face)
    .rect(0, 0, width, 1)
    .fill(e.bandLight);
  // 各栏之间凹下去的分隔
  g.rect(split, 3, 1, STATUS_HEIGHT - 6).fill(LUNA.edgeShadow);
  g.rect(split + 1, 3, 1, STATUS_HEIGHT - 6).fill(LUNA.edgeHighlight);
  const leftText = xpText(left);
  leftText.anchor.set(0, 0.5);
  leftText.position.set(6, STATUS_HEIGHT / 2);
  const rightText = xpText(right);
  rightText.anchor.set(0, 0.5);
  rightText.position.set(split + 8, STATUS_HEIGHT / 2);
  bar.addChild(g, leftText, rightText);
  return bar;
}

// ---------- 工具栏按钮与图标 ----------

/**
 * 工具栏按钮：图标 + 可选文字 + 可选的下拉小三角。平时是平的，鼠标移上去凸起；
 * onTap 为 null 的按钮只是摆设（原版里对应的功能在这里用不到）。
 */
function toolbarButton(
  icon: Container,
  label: string,
  dropdown: boolean,
  onTap: (() => void) | null,
): { view: Container; width: number } {
  const view = new Container({ label: `toolbar-${label || 'button'}` });
  const height = TOOLBAR_HEIGHT - 6;
  icon.position.set(4, (height - icon.height) / 2);
  let width = 4 + icon.width + 4;
  const parts: Container[] = [icon];
  if (label) {
    const text = xpText(label);
    text.anchor.set(0, 0.5);
    text.position.set(width, height / 2);
    width += Math.ceil(text.width) + 6;
    parts.push(text);
  }
  if (dropdown) {
    parts.push(new Graphics().poly([width, 15, width + 5, 15, width + 2.5, 18]).fill(LUNA.ink));
    width += 9;
  }
  const hot = new Graphics();
  topRoundedRect(hot, 0, 0, width, height, 3).fill({ color: LUNA.white, alpha: 0.35 });
  edgeRing(hot, 0, 0, width, height, {
    top: LUNA.explorer.hotEdgeLight,
    left: LUNA.explorer.hotEdgeLight,
    right: LUNA.explorer.hotEdgeDark,
    bottom: LUNA.explorer.hotEdgeDark,
  });
  hot.visible = false;
  view.addChild(hot, ...parts);
  if (onTap) {
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerover', () => (hot.visible = true));
    view.on('pointerout', () => (hot.visible = false));
    view.on('pointertap', onTap);
  }
  return { view, width };
}

/** 绿色圆形里一个向左的箭头（后退）；本地没有原版图标，矢量绘制 */
function drawBackIcon(size: number): Graphics {
  const e = LUNA.explorer;
  const r = size / 2;
  const k = size / 28;
  return new Graphics()
    .circle(r, r, r - 1)
    .fill(e.go)
    .stroke({ width: 1, color: e.goEdge })
    .moveTo(r + 2 * k, r - 6 * k)
    .lineTo(r - 4 * k, r)
    .lineTo(r + 2 * k, r + 6 * k)
    .stroke({ width: 3 * k, color: LUNA.white, cap: 'round', join: 'round' });
}

/** 灰掉的前进按钮 */
function drawForwardIcon(): Graphics {
  const e = LUNA.explorer;
  return new Graphics()
    .circle(13, 13, 12)
    .fill(e.goDisabled)
    .stroke({ width: 1, color: e.goDisabledEdge })
    .moveTo(11, 7)
    .lineTo(17, 13)
    .lineTo(11, 19)
    .stroke({ width: 3, color: LUNA.white, cap: 'round', join: 'round' });
}

/** 向上：黄色文件夹加一个绿色向上箭头 */
function drawUpIcon(): Container {
  const root = new Container();
  const folder = iconSprite('folder', 26);
  const arrow = new Graphics()
    .moveTo(13, 21)
    .lineTo(13, 12)
    .moveTo(9, 15.5)
    .lineTo(13, 11.5)
    .lineTo(17, 15.5)
    .stroke({ width: 2.4, color: LUNA.explorer.goEdge, cap: 'round', join: 'round' });
  root.addChild(folder, arrow);
  return root;
}

/** 查看：四个蓝色小方块 */
function drawViewsIcon(): Graphics {
  const g = new Graphics();
  for (const [x, y] of [
    [3, 3],
    [14, 3],
    [3, 14],
    [14, 14],
  ] as const) {
    g.rect(x, y, 7, 7).fill('#6d9be8').stroke({ width: 1, color: '#2c5bb0', alignment: 1 });
  }
  return g;
}

/** 任务窗格「Play this level」的绿色播放图标 */
function drawPlayIcon(): Graphics {
  return new Graphics()
    .circle(8, 8, 7)
    .fill(LUNA.explorer.go)
    .poly([6.5, 4.5, 11, 8, 6.5, 11.5])
    .fill(LUNA.white);
}

// ---------- 任务窗格分组 ----------

interface TaskLink {
  icon: Container;
  label: string;
  onTap: () => void;
}

/** 分组的外框：圆角标题条 + 浅蓝内容区 */
function taskGroupFrame(title: string, bodyHeight: number): Container {
  const e = LUNA.explorer;
  const width = TASK_PANE_WIDTH - GROUP_MARGIN * 2;
  const group = new Container({ label: `group-${title}` });
  const g = new Graphics();
  topRoundedRect(g, 0, 0, width, GROUP_HEADER_HEIGHT, 3).fill(horizontalGradient(e.groupHeader));
  g.rect(0, GROUP_HEADER_HEIGHT, width, bodyHeight)
    .fill(LUNA.white)
    .rect(1, GROUP_HEADER_HEIGHT, width - 2, bodyHeight - 1)
    .fill(e.groupBody);

  const text = xpText(title, { fontWeight: '700', fill: e.groupHeaderText });
  text.anchor.set(0, 0.5);
  text.position.set(10, GROUP_HEADER_HEIGHT / 2);

  // 右边的折叠按钮：白色圆，里面两道向上的折线
  const cx = width - 14;
  const cy = GROUP_HEADER_HEIGHT / 2;
  const chevron = new Graphics()
    .circle(cx, cy, 8)
    .fill(LUNA.white)
    .stroke({ width: 1, color: '#b9c9ef' });
  for (const dy of [-2, 2]) {
    chevron
      .moveTo(cx - 3, cy + dy + 1.5)
      .lineTo(cx, cy + dy - 1.5)
      .lineTo(cx + 3, cy + dy + 1.5);
  }
  chevron.stroke({ width: 1.4, color: e.groupHeaderText });

  group.addChild(g, text, chevron);
  return group;
}

/** 一组可点的任务链接；鼠标移上去变亮蓝并加下划线，和原版一样 */
function taskGroup(title: string, links: TaskLink[]): { view: Container; height: number } {
  const bodyHeight = 8 + links.length * LINK_HEIGHT + 6;
  const group = taskGroupFrame(title, bodyHeight);
  const width = TASK_PANE_WIDTH - GROUP_MARGIN * 2;
  links.forEach(({ icon, label, onTap }, i) => {
    const row = new Container({ label: `task-${label}` });
    row.position.set(10, GROUP_HEADER_HEIGHT + 8 + i * LINK_HEIGHT);
    icon.position.set(0, (LINK_HEIGHT - 16) / 2);
    const text = xpText(label, { fill: LUNA.explorer.link });
    text.anchor.set(0, 0.5);
    text.position.set(22, LINK_HEIGHT / 2);
    const underline = new Graphics()
      .rect(22, LINK_HEIGHT / 2 + 7, Math.ceil(text.width), 1)
      .fill(LUNA.explorer.linkHot);
    underline.visible = false;
    row.addChild(icon, text, underline);
    row.eventMode = 'static';
    row.hitArea = new Rectangle(0, 0, width - 20, LINK_HEIGHT);
    row.on('pointerover', () => {
      text.style.fill = LUNA.explorer.linkHot;
      underline.visible = true;
    });
    row.on('pointerout', () => {
      text.style.fill = LUNA.explorer.link;
      underline.visible = false;
    });
    row.on('pointertap', onTap);
    group.addChild(row);
  });
  return { view: group, height: GROUP_HEADER_HEIGHT + bodyHeight };
}
