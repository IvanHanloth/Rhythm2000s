// 下拉菜单（NSMenu，10.0–10.2 样式）：从菜单栏下沿垂下，上方直角、下方两角小圆角，
// 略透明的白色细条纹底、大而柔和的投影。条目 20 像素高，左边留出勾选列，右边是快捷键或子菜单箭头。
// 鼠标所在的条目是蓝色果冻底、白字。原点在菜单左上角。

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { aquaText, drawWindowShadow, stripes, vGradient } from './paint.ts';

export const MENU_ITEM_HEIGHT = 20;
const SEPARATOR_HEIGHT = 12;
const PADDING_Y = 4;
/** 文字左边留出的勾选列 */
const TEXT_X = 20;
const PADDING_RIGHT = 14;
/** 文字和快捷键之间至少留的空 */
const SHORTCUT_GAP = 28;
const RADIUS = 5;
const FONT_SIZE = 14;

export interface MenuItemSpec {
  label: string;
  /** 快捷键，例如「⇧⌘Q」 */
  shortcut?: string;
  /** 有子菜单：右边画一个小三角 */
  submenu?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItemSpec | 'separator';

export interface AquaMenuOptions {
  entries: readonly MenuEntry[];
  minWidth?: number;
}

interface ItemView {
  spec: MenuItemSpec;
  top: number;
  texts: Text[];
  arrow: Graphics | null;
}

export class AquaMenu {
  readonly view = new Container({ label: 'menu' });
  readonly width: number;
  readonly height: number;
  private readonly items: ItemView[] = [];
  private readonly highlight: Graphics;
  private hot: string | null = null;

  constructor({ entries, minWidth = 180 }: AquaMenuOptions) {
    // 先排版文字，量出最宽的一行
    let y = PADDING_Y;
    let widest = minWidth;
    const content = new Container({ label: 'items' });
    const separators: number[] = [];
    for (const entry of entries) {
      if (entry === 'separator') {
        separators.push(y + SEPARATOR_HEIGHT / 2);
        y += SEPARATOR_HEIGHT;
        continue;
      }
      const color = entry.disabled ? AQUA.menu.disabled : AQUA.ink;
      const label = aquaText(entry.label, { size: FONT_SIZE, color });
      label.anchor.set(0, 0.5);
      label.position.set(TEXT_X, y + MENU_ITEM_HEIGHT / 2);
      const texts = [label];
      let rowWidth = TEXT_X + label.width + PADDING_RIGHT;
      if (entry.shortcut) {
        const shortcut = aquaText(entry.shortcut, { size: FONT_SIZE, color });
        shortcut.anchor.set(1, 0.5);
        shortcut.y = y + MENU_ITEM_HEIGHT / 2;
        texts.push(shortcut);
        rowWidth += SHORTCUT_GAP + shortcut.width;
      }
      if (entry.submenu) rowWidth += SHORTCUT_GAP;
      widest = Math.max(widest, Math.ceil(rowWidth));
      content.addChild(...texts);
      this.items.push({ spec: entry, top: y, texts, arrow: null });
      y += MENU_ITEM_HEIGHT;
    }
    this.width = widest;
    this.height = y + PADDING_Y;

    // 快捷键靠右对齐；子菜单箭头放在最右
    for (const item of this.items) {
      const shortcut = item.texts[1];
      if (shortcut) shortcut.x = this.width - PADDING_RIGHT;
      if (item.spec.submenu) {
        const cx = this.width - PADDING_RIGHT - 3;
        const cy = item.top + MENU_ITEM_HEIGHT / 2;
        item.arrow = new Graphics()
          .poly([cx - 3, cy - 5, cx + 3, cy, cx - 3, cy + 5])
          .fill(AQUA.ink);
        content.addChild(item.arrow);
      }
    }

    const body = bottomRoundedRect(new Graphics(), 0, 0, this.width, this.height, RADIUS)
      .fill({ fill: stripes(AQUA.menuStripe), alpha: AQUA.menu.alpha })
      .stroke({ width: 1, color: AQUA.menu.edge, alpha: 0.35, alignment: 1 });
    const lines = new Graphics();
    for (const lineY of separators) {
      lines.rect(1, Math.round(lineY), this.width - 2, 1).fill(AQUA.menu.separator);
    }

    this.highlight = new Graphics().rect(0, 0, this.width, MENU_ITEM_HEIGHT).fill(
      vGradient([
        [0, AQUA.menu.highlightTop],
        [1, AQUA.menu.highlightBottom],
      ]),
    );
    this.highlight.visible = false;

    this.view.addChild(
      drawWindowShadow(this.width, this.height, 0.4),
      body,
      lines,
      this.highlight,
      content,
    );
  }

  /** 某个条目的中心（菜单自己的坐标）；没有这个条目时返回 null */
  itemCenter(label: string): { x: number; y: number } | null {
    const item = this.items.find((i) => i.spec.label === label);
    if (!item) return null;
    return { x: this.width / 2, y: item.top + MENU_ITEM_HEIGHT / 2 };
  }

  /** 鼠标所在的条目：蓝色果冻底、白字；null 表示没有 */
  setHot(label: string | null): void {
    if (label === this.hot) return;
    this.hot = label;
    const hotItem = this.items.find((i) => i.spec.label === label && !i.spec.disabled);
    this.highlight.visible = hotItem !== undefined;
    if (hotItem) this.highlight.y = hotItem.top;
    for (const item of this.items) {
      const color =
        item === hotItem ? AQUA.white : item.spec.disabled ? AQUA.menu.disabled : AQUA.ink;
      for (const text of item.texts) text.style.fill = color;
      item.arrow?.clear();
      if (item.arrow) {
        const cx = this.width - PADDING_RIGHT - 3;
        const cy = item.top + MENU_ITEM_HEIGHT / 2;
        item.arrow.poly([cx - 3, cy - 5, cx + 3, cy, cx - 3, cy + 5]).fill(color);
      }
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/** 只圆下方两个角的矩形路径（菜单的外形：上方贴着菜单栏）。画完路径再 fill / stroke。 */
function bottomRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Graphics {
  return g
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineTo(x + width, y + height - radius)
    .arcTo(x + width, y + height, x + width - radius, y + height, radius)
    .lineTo(x + radius, y + height)
    .arcTo(x, y + height, x, y + height - radius, radius)
    .closePath();
}

/** 苹果菜单（10.2 英文版的条目，按记忆写的，没有对照原机核对） */
export const APPLE_MENU: readonly MenuEntry[] = [
  { label: 'About This Mac' },
  { label: 'Get Mac OS X Software…' },
  'separator',
  { label: 'System Preferences…' },
  { label: 'Dock', submenu: true },
  { label: 'Location', submenu: true },
  'separator',
  { label: 'Recent Items', submenu: true },
  'separator',
  { label: 'Force Quit…', shortcut: '⌥⌘⎋' },
  'separator',
  { label: 'Sleep' },
  { label: 'Restart…' },
  { label: 'Shut Down…' },
  'separator',
  { label: 'Log Out…', shortcut: '⇧⌘Q' },
];
