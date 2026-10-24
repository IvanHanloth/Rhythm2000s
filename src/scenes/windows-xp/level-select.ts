// Level select: the "My Levels" folder in an XP Explorer window (CabinetWClass) (doc/level-select.md).
// Menu bar, standard toolbar, address bar, task pane on the left, tiles on the right and a status bar, at original size.
// Click an icon to select it; double-click or "Play this level" starts; "Back" returns to the café. Origin at the top left.
// The task pane also imports, exports and deletes charts (doc/chart-import-export.md); its links follow the selection.

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { ACTION_LABELS } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { formatDuration, summarizeChart } from '@/rhythm/chart-summary.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import { DoubleClick } from '@/ui/double-click.ts';
import { xpAssets } from './assets.ts';
import { horizontalGradient, topRoundedRect, verticalGradient } from './components/draw.ts';
import {
  ADDRESS_HEIGHT,
  addressBar,
  drawBackIcon,
  drawForwardIcon,
  iconSprite,
  MENU_HEIGHT,
  menuBar,
  STATUS_HEIGHT,
  statusBar,
  TOOLBAR_HEIGHT,
  toolbarButton,
} from './components/explorer-bars.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, XpWindowFrame } from './components/window-frame.ts';
import { xpText } from './components/xp-text.ts';
import { autoXpIcon } from './system-icons.ts';

export const EXPLORER_TITLE = 'My Levels';
const ADDRESS = 'C:\\Rhythm 2000s\\My Levels\\XP Desktop';

const TASK_PANE_WIDTH = 200;
const GROUP_MARGIN = 12;
const GROUP_HEADER_HEIGHT = 25;
const LINK_HEIGHT = 20;
/** Tiles view */
const VIEW_PADDING_X = 18;
const VIEW_PADDING_Y = 14;
const TILE_COLUMNS = 3;
const TILE_HEIGHT = 56;
const TILE_GAP_X = 18;
const TILE_GAP_Y = 10;
const TILE_ICON = 48;

const MENUS = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'];

export interface XpLevelSelectOptions {
  /** Every chart on this computer, in index order */
  charts: readonly Chart[];
  width: number;
  height: number;
  /** Start level `index` (double-click, "Play this level", Enter) */
  onStart(index: number): void;
  /** Back to the café (toolbar "Back", task pane "Back to the café") */
  onBack(): void;
  /** The chart was imported by the player, so "Delete this level" is offered */
  isImported(chart: Chart): boolean;
  /** "Import a level" */
  onImport(): void;
  /** "Export this level" for level `index` */
  onExport(index: number): void;
  /** "Delete this level" for level `index` */
  onDelete(index: number): void;
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
  /** "Level Tasks" and "Details", rebuilt on every selection */
  private readonly taskGroups = new Container({ label: 'task-groups' });
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
      menuBar(clientWidth, MENUS),
      this.toolbar(clientWidth),
      addressBar(clientWidth, ADDRESS, 'folder-open'),
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

  /** Selects level `index`, updating the highlight and "Details" */
  select(index: number): void {
    const count = this.options.charts.length;
    if (count === 0) {
      this.renderTaskGroups(null);
      return;
    }
    this.selected = Math.min(count - 1, Math.max(0, index));
    this.tiles.forEach((tile, i) => {
      const on = i === this.selected;
      tile.icon.tint = on ? LUNA.explorer.selectedIconTint : '#ffffff';
      tile.labelBack.visible = on;
      tile.label.style.fill = on ? LUNA.white : LUNA.ink;
    });
    this.renderTaskGroups(this.options.charts[this.selected]!);
  }

  /** Arrow keys: left and right by one tile, up and down by a row */
  move(dx: number, dy: number): void {
    this.select(this.selected + dx + dy * TILE_COLUMNS);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  // ---------- Tiles ----------

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
    const icon = new Sprite(xpAssets().icon(chart.icon ?? autoXpIcon(summary.actions)));
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

  // ---------- Task pane ----------

  private taskPane(height: number): Container {
    const pane = new Container({ label: 'task-pane' });
    pane.addChild(
      new Graphics()
        .rect(0, 0, TASK_PANE_WIDTH, height)
        .fill(verticalGradient(LUNA.explorer.taskPane)),
    );

    pane.addChild(this.taskGroups);
    return pane;
  }

  /** Like XP's "File and Folder Tasks", the links depend on the selection: delete only for imported levels */
  private renderTaskGroups(chart: Chart | null): void {
    for (const child of this.taskGroups.removeChildren()) child.destroy({ children: true });
    const { options } = this;
    const links: TaskLink[] = [];
    if (chart) {
      links.push({
        icon: drawPlayIcon(),
        label: 'Play this level',
        onTap: () => this.startSelected(),
      });
    }
    links.push({
      icon: iconSprite('folder-open', 16),
      label: 'Import a level',
      onTap: () => options.onImport(),
    });
    if (chart) {
      links.push({
        icon: iconSprite('text-document', 16),
        label: 'Export this level',
        onTap: () => options.onExport(this.selected),
      });
    }
    if (chart && options.isImported(chart)) {
      links.push({
        icon: iconSprite('delete', 16),
        label: 'Delete this level',
        onTap: () => options.onDelete(this.selected),
      });
    }
    links.push({
      icon: drawBackIcon(16),
      label: 'Back to the café',
      onTap: () => options.onBack(),
    });
    const tasks = taskGroup('Level Tasks', links);
    tasks.view.position.set(GROUP_MARGIN, GROUP_MARGIN);

    const details = this.detailsGroup(chart);
    details.position.set(GROUP_MARGIN, GROUP_MARGIN + tasks.height + GROUP_MARGIN);
    this.taskGroups.addChild(tasks.view, details);
  }

  private startSelected(): void {
    if (this.options.charts.length > 0) this.options.onStart(this.selected);
  }

  /** "Details", as tall as its text */
  private detailsGroup(chart: Chart | null): Container {
    const content = new Container({ label: 'details' });
    content.position.set(10, GROUP_HEADER_HEIGHT + 8);
    const wrap = TASK_PANE_WIDTH - GROUP_MARGIN * 2 - 20;
    if (chart) {
      this.fillDetails(content, chart, wrap);
    } else {
      content.addChild(
        xpText('There are no levels on this computer yet.', {
          wordWrap: true,
          wordWrapWidth: wrap,
        }),
      );
    }
    const group = taskGroupFrame('Details', Math.ceil(content.height) + 18);
    group.addChild(content);
    return group;
  }

  private fillDetails(content: Container, chart: Chart, wrap: number): void {
    const summary = summarizeChart(chart);
    const name = xpText(chart.title, { fontWeight: '700', wordWrap: true, wordWrapWidth: wrap });
    content.addChild(name);
    let y = Math.ceil(name.height) + 2;
    if (this.options.isImported(chart)) {
      const kind = xpText('Imported level', { fill: LUNA.explorer.subText });
      kind.y = y;
      content.addChild(kind);
      y += 17;
    }
    const lines = xpText(
      [
        `Actions: ${summary.actions.map((a) => ACTION_LABELS[a]).join(', ')}`,
        `Tempo: ${chart.bpm} BPM`,
        `Phrases: ${summary.phrases}`,
        `Length: ${formatDuration(summary.seconds)}`,
      ].join('\n'),
      { wordWrap: true, wordWrapWidth: wrap, breakWords: true, lineHeight: 17 },
    );
    lines.y = y;
    content.addChild(lines);
  }

  // ---------- Toolbar ----------

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

function actionText(actions: readonly (keyof typeof ACTION_LABELS)[]): string {
  return actions.length === 1 ? ACTION_LABELS[actions[0]!] : `${actions.length} action types`;
}

// ---------- Toolbar icons ----------

/** Up: a yellow folder with a green up arrow */
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

/** Views: four small blue squares */
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

/** Green play icon for "Play this level" */
function drawPlayIcon(): Graphics {
  return new Graphics()
    .circle(8, 8, 7)
    .fill(LUNA.explorer.go)
    .poly([6.5, 4.5, 11, 8, 6.5, 11.5])
    .fill(LUNA.white);
}

// ---------- Task pane groups ----------

interface TaskLink {
  icon: Container;
  label: string;
  onTap: () => void;
}

/** Group frame: rounded header bar over a pale blue body */
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

  // Collapse button on the right: a white circle with two upward chevrons
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

/** A group of task links; hovering turns them bright blue and underlined, like the original */
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
