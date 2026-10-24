// Pull-down menu (NSMenu, 10.0–10.2): drops from the menu bar with square top corners and small rounded bottom ones,
// slightly translucent white pinstripes and a large soft shadow. 20 px items with a check column on the left and
// shortcuts or submenu arrows on the right; the hovered item is white on blue gel. Origin at the top left.

import { Container, Graphics, type Text } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { aquaText, drawWindowShadow, stripes, vGradient } from './paint.ts';

export const MENU_ITEM_HEIGHT = 20;
const SEPARATOR_HEIGHT = 12;
const PADDING_Y = 4;
/** Check column left of the text */
const TEXT_X = 20;
const PADDING_RIGHT = 14;
/** Minimum gap between text and shortcut */
const SHORTCUT_GAP = 28;
const RADIUS = 5;
const FONT_SIZE = 14;

export interface MenuItemSpec {
  label: string;
  /** Shortcut, e.g. "⇧⌘Q" */
  shortcut?: string;
  /** Has a submenu: a small arrow on the right */
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
    // Lay out the text first to find the widest line
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

    // Shortcuts right-aligned; submenu arrows at the far right
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

  /** Centre of an item (menu coordinates) */
  itemCenter(label: string): { x: number; y: number } {
    const item = this.items.find((i) => i.spec.label === label);
    if (!item) throw new Error(`No menu item "${label}"`);
    return { x: this.width / 2, y: item.top + MENU_ITEM_HEIGHT / 2 };
  }

  /** The enabled item without a submenu at height y (menu coordinates), if any */
  itemAt(y: number): string | null {
    const item = this.items.find(
      (i) => !i.spec.disabled && !i.spec.submenu && y >= i.top && y < i.top + MENU_ITEM_HEIGHT,
    );
    return item?.spec.label ?? null;
  }

  /** The hovered item, white on blue gel; null for none */
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

/** Rectangle path with only the bottom corners rounded (a menu hangs from the menu bar). Fill or stroke after. */
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

/** The Apple menu item that opens the settings window (doc/settings.md) */
export const SYSTEM_PREFERENCES = 'System Preferences…';

/** Apple menu items that leave the computer for the café */
export const SHUT_DOWN = 'Shut Down…';
export const LOG_OUT = 'Log Out…';

/** The Apple menu (10.2 English items, from memory, not checked on a real machine) */

export const APPLE_MENU: readonly MenuEntry[] = [
  { label: 'About This Mac' },
  { label: 'Get Mac OS X Software…' },
  'separator',
  { label: SYSTEM_PREFERENCES },
  { label: 'Dock', submenu: true },
  { label: 'Location', submenu: true },
  'separator',
  { label: 'Recent Items', submenu: true },
  'separator',
  { label: 'Force Quit…', shortcut: '⌥⌘⎋' },
  'separator',
  { label: 'Sleep' },
  { label: 'Restart…' },
  { label: SHUT_DOWN },
  'separator',
  { label: LOG_OUT, shortcut: '⇧⌘Q' },
];
