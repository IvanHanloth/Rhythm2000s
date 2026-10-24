// Level select: Jaguar Finder's "My Levels" window (icon view) with a Get Info window beside it
// (doc/level-select.md, doc/scenes/mac-2000.md "Level select"), at original pixel size.
// Click an icon to select it; double-click or "Start" in the info window starts; "Back" returns to the café. Origin at the screen's top left.
// The toolbar's "Import", "Export" and "Delete" handle chart files (doc/chart-import-export.md); Delete only works on imported levels.

import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import type { Chart } from '@/rhythm/chart.ts';
import { formatDuration, summarizeChart } from '@/rhythm/chart-summary.ts';
import { AQUA } from '@/theme/aqua.ts';
import { DoubleClick } from '@/ui/double-click.ts';
import { isMacAction, MAC_ACTIONS, type MacTargetKind } from './action-kinds.ts';
import { appIcon, type AppIconName } from './assets.ts';
import { drawCautionIcon, drawDocumentIcon, drawTrashIcon } from './components/icons.ts';
import { aquaText, drawGelPill } from './components/paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './components/push-button.ts';
import { AquaWindow, TITLE_BAR_HEIGHT } from './components/window.ts';

/** Finder and info window positions on the virtual screen (the mock-up scaled to 1024×576) */
const FINDER = { x: 56, y: 40, width: 616, height: 445 };
// Wide enough for titles like "Take Out the Trash Info" without running into the window buttons
const INFO = { x: 688, y: 74, width: 296, height: 252 };

const TOOLBAR_HEIGHT = 58;
const GRID_PADDING_X = 21;
const GRID_PADDING_Y = 18;
const GRID_COLUMNS = 5;
const CELL_HEIGHT = 100;
const ICON_BOX = 60;
const ICON_SIZE = 48;

/** Names in the info window's "Actions" row, grouped by widget (all three alerts are "Alert") to keep remix levels short */
const KIND_LABELS: Record<MacTargetKind, string> = {
  alert: 'Alert',
  dock: 'Dock bounce',
  mail: 'New mail',
  window: 'Minimize',
  menu: 'Apple menu',
  file: 'Trash',
  sheet: 'Save sheet',
  chat: 'iChat',
  volume: 'Volume',
  chair: 'Swivel chair',
};

/** Icon standing for each widget kind; levels mixing several use iTunes (a remix) */
const KIND_ICONS: Record<MacTargetKind, AppIconName | 'caution' | 'trash'> = {
  alert: 'caution',
  dock: 'iChat',
  mail: 'Mail',
  window: 'TextEdit',
  menu: 'System Preferences',
  file: 'trash',
  sheet: 'TextEdit',
  chat: 'iChat',
  volume: 'iTunes',
  // The cutaway is a little film of the café (provisional)
  chair: 'QuickTime Player',
};

export interface MacLevelSelectOptions {
  /** Every chart on this computer, in index order */
  charts: readonly Chart[];
  /** Start level `index` (double-click, "Start", Enter) */
  onStart(index: number): void;
  /** Back to the café (the toolbar's or the info window's "Back") */
  onBack(): void;
  /** The chart was imported by the player, so "Delete" works on it */
  isImported(chart: Chart): boolean;
  /** Toolbar "Import" */
  onImport(): void;
  /** Toolbar "Export" for level `index` */
  onExport(index: number): void;
  /** Toolbar "Delete" for level `index` */
  onDelete(index: number): void;
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
  /** Toolbar "Delete", dimmed unless an imported level is selected */
  private readonly deleteItem: Container;
  private info: InfoWindow | null = null;
  private selected = 0;

  constructor(options: MacLevelSelectOptions) {
    this.options = options;
    const { charts } = options;
    this.finder = new AquaWindow({
      title: 'My Levels',
      width: FINDER.width,
      height: FINDER.height,
      content: 'white',
      toolbarHeight: TOOLBAR_HEIGHT,
      statusText: `${charts.length} ${charts.length === 1 ? 'item' : 'items'}, double-click a level to start`,
    });
    this.finder.view.position.set(FINDER.x + FINDER.width / 2, FINDER.y + FINDER.height / 2);
    const toolbar = this.toolbar();
    this.deleteItem = toolbar.deleteItem;
    this.finder.toolbar.addChild(toolbar.view);
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
    const chart = this.options.charts[this.selected] ?? null;
    const deletable = chart !== null && this.options.isImported(chart);
    this.deleteItem.alpha = deletable ? 1 : 0.4;
    this.deleteItem.eventMode = deletable ? 'static' : 'none';
    this.showInfo(chart);
  }

  /** Arrow keys: left and right by one icon, up and down by a row */
  move(dx: number, dy: number): void {
    this.select(this.selected + dx + dy * GRID_COLUMNS);
  }

  /** Call every frame with the audio time so "Start" pulses */
  update(audioTime: number): void {
    this.info?.update(audioTime);
  }

  /** Both windows go inactive while an alert covers them */
  setActive(active: boolean): void {
    this.finder.setActive(active);
    this.info?.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private showInfo(chart: Chart | null): void {
    this.info?.destroy();
    const imported = chart !== null && this.options.isImported(chart);
    this.info = new InfoWindow(chart, imported, {
      onStart: () => {
        if (chart) this.options.onStart(this.selected);
      },
      onBack: () => this.options.onBack(),
    });
    this.view.addChild(this.info.view);
  }

  // ---------- Icon view ----------

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

  // ---------- Toolbar ----------

  private toolbar(): { view: Container; deleteItem: Container } {
    const bar = new Container({ label: 'finder-toolbar' });
    let x = 12;
    const add = (icon: Container, iconWidth: number, label: string, onTap?: () => void) => {
      const item = new Container({ label: `toolbar-${label}` });
      const text = aquaText(label, { size: 11 });
      // Labels wider than their icon ("Rhythm 2000s") set the spacing so neighbours don't crowd
      const width = Math.max(48, iconWidth + 8, Math.ceil(text.width) + 8);
      icon.position.set((width - iconWidth) / 2, 6);
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
      return item;
    };
    const { options } = this;
    add(drawBackButton(), 32, 'Back', () => options.onBack());
    add(drawViewButtons(), 90, 'View');
    // Import, Export and Delete took the places of the decorative Computer and Home items
    add(drawTransferIcon('in'), 32, 'Import', () => options.onImport());
    add(drawTransferIcon('out'), 32, 'Export', () => {
      if (options.charts.length > 0) options.onExport(this.selected);
    });
    const deleteItem = add(drawTrashIcon(32), 32, 'Delete', () => options.onDelete(this.selected));
    add(drawFolderIcon(), 32, 'Rhythm 2000s');

    // Search field on the right
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
    const hint = aquaText('Search', { size: 11, color: AQUA.inkMuted });
    hint.anchor.set(0, 0.5);
    hint.position.set(24, 10);
    search.addChild(field, hint);
    search.position.set(FINDER.width - 120 - 14, 14);
    bar.addChild(search);
    return { view: bar, deleteItem };
  }
}

/** Widget kinds the chart uses, in order of first appearance */
function chartKinds(chart: Chart): MacTargetKind[] {
  const actions = summarizeChart(chart).actions.filter(isMacAction);
  return [...new Set(actions.map((a) => MAC_ACTIONS[a].kind))];
}

/** Level icon: the widget's icon when the chart uses one kind, iTunes for a mix */
function levelIcon(chart: Chart, size: number): Container {
  const kinds = chartKinds(chart);
  const only = kinds.length === 1 ? kinds[0]! : null;
  const name = only ? KIND_ICONS[only] : 'iTunes';
  if (name === 'caution') return drawCautionIcon(size);
  if (name === 'trash') return drawTrashIcon(size, { full: true });
  return appIcon(name, size);
}

// ---------- Info window ----------

/** Get Info window: large icon and name, actions, tempo, phrases and length under "General", "Back" and "Start" at the bottom right */
class InfoWindow {
  readonly view: Container;
  private readonly window: AquaWindow;
  private readonly buttons: PushButton[] = [];

  constructor(
    chart: Chart | null,
    imported: boolean,
    handlers: { onStart: () => void; onBack: () => void },
  ) {
    const name = chart?.title ?? 'No Levels';
    this.window = new AquaWindow({
      title: `${name} Info`,
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
    const kind = aquaText(imported ? 'Imported level' : 'Rhythm 2000s level', {
      size: 11,
      color: AQUA.inkSoft,
    });
    kind.position.set(72, 36);
    content.addChild(title, kind);

    const disclosure = aquaText('▾ General:', { size: 12 });
    disclosure.position.set(14, 72);
    content.addChild(disclosure);

    const rows: [string, string][] = chart
      ? (() => {
          const summary = summarizeChart(chart);
          return [
            [
              'Actions:',
              chartKinds(chart)
                .map((k) => KIND_LABELS[k])
                .join(', '),
            ],
            ['Tempo:', `${chart.bpm} BPM`],
            ['Phrases:', String(summary.phrases)],
            ['Length:', formatDuration(summary.seconds)],
          ];
        })()
      : [['', 'There are no playable levels on this computer.']];
    // Long values wrap, so rows stack by their real height and the frame is drawn last
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

    // Buttons at the bottom right, default rightmost
    const contentHeight = INFO.height - TITLE_BAR_HEIGHT;
    const buttonTop = contentHeight - PUSH_BUTTON_HEIGHT - 14;
    const back = new PushButton({ label: 'Back' });
    const start = new PushButton({ label: 'Start', isDefault: chart !== null });
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

// ---------- Toolbar icons (vector versions of the originals, which aren't available) ----------

/** Back: a left arrow in a white gel square */
function drawBackButton(): Graphics {
  return drawGelPill(new Graphics(), 0, 2, 32, 26, AQUA.gel.white)
    .moveTo(19, 9)
    .lineTo(13, 15)
    .lineTo(19, 21)
    .stroke({ width: 2, color: AQUA.inkSoft, cap: 'round', join: 'round' });
}

/** View: icon (selected, blue), list and column segments */
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

/** Import / Export: a document with a blue arrow going into it or coming out of it */
function drawTransferIcon(direction: 'in' | 'out'): Container {
  const root = new Container();
  const page = drawDocumentIcon(30);
  page.position.set(1, 1);
  // The arrow points down onto the page for Import and up off it for Export
  const [from, to] = direction === 'in' ? [5, 21] : [21, 5];
  const head = direction === 'in' ? -5 : 5;
  const arrow = new Graphics()
    .moveTo(16, from)
    .lineTo(16, to)
    .moveTo(11, to + head)
    .lineTo(16, to)
    .lineTo(21, to + head)
    .stroke({ width: 3, color: AQUA.selection, cap: 'round', join: 'round' });
  root.addChild(page, arrow);
  return root;
}

/** Levels folder: an Aqua blue folder */
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
