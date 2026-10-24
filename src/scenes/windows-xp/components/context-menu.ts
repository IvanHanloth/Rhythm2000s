// Context menu (window class #32768, XP flat menu): white, 1 px grey border, shadow at the bottom right;
// the hovered item is white on blue, disabled items grey, submenus get a small black arrow. Origin at the top left.
// Desktop menu items: doc/scenes/windows-xp.md "Desktop context menu and Refresh".

import { Container, Graphics, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpText } from './xp-text.ts';

export type MenuEntry = { label: string; submenu?: boolean; disabled?: boolean } | 'separator';

/** The English XP context menu on empty desktop */
export const DESKTOP_MENU: readonly MenuEntry[] = [
  { label: 'Arrange Icons By', submenu: true },
  { label: 'Refresh' },
  'separator',
  { label: 'Paste', disabled: true },
  { label: 'Paste Shortcut', disabled: true },
  'separator',
  { label: 'New', submenu: true },
  'separator',
  { label: 'Properties' },
];

const ITEM_HEIGHT = 19;
const SEPARATOR_HEIGHT = 9;
/** Border plus top and bottom padding */
const PADDING = 3;
/** Room left of the text for check marks */
const TEXT_LEFT = 20;
/** Room right of the text for submenu arrows */
const TEXT_RIGHT = 32;
const MIN_WIDTH = 150;
const SHADOW = 4;

interface ItemView {
  label: string;
  top: number;
  disabled: boolean;
  text: Text;
  arrow: Graphics | null;
}

export class XpContextMenu {
  readonly view = new Container({ label: 'context-menu' });
  readonly width: number;
  readonly height: number;
  private readonly highlight = new Graphics();
  private readonly items: ItemView[] = [];
  /** The highlighted item; undefined before the first draw */
  private hot: string | null | undefined = undefined;

  constructor(entries: readonly MenuEntry[] = DESKTOP_MENU) {
    const content = new Container({ label: 'items' });
    let y = PADDING;
    let textWidth = 0;
    const separators: number[] = [];
    for (const entry of entries) {
      if (entry === 'separator') {
        separators.push(y + Math.floor(SEPARATOR_HEIGHT / 2));
        y += SEPARATOR_HEIGHT;
        continue;
      }
      const disabled = entry.disabled ?? false;
      const text = xpText(entry.label, { fill: disabled ? LUNA.inkDisabled : LUNA.ink });
      text.anchor.set(0, 0.5);
      text.position.set(TEXT_LEFT, y + ITEM_HEIGHT / 2);
      textWidth = Math.max(textWidth, text.width);
      content.addChild(text);
      const arrow = entry.submenu ? new Graphics() : null;
      if (arrow) content.addChild(arrow);
      this.items.push({ label: entry.label, top: y, disabled, text, arrow });
      y += ITEM_HEIGHT;
    }
    this.width = Math.ceil(Math.max(MIN_WIDTH, TEXT_LEFT + textWidth + TEXT_RIGHT));
    this.height = y + PADDING;

    // Flat menu shadow: a fading strip along the right and bottom
    const shadow = new Graphics();
    for (let i = 1; i <= SHADOW; i++) {
      const alpha = 0.12 * (1 - (i - 1) / SHADOW);
      shadow.rect(this.width, i, i, this.height - 1).fill({ color: '#000000', alpha });
      shadow.rect(i, this.height, this.width - 1, i).fill({ color: '#000000', alpha });
    }
    const face = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill(LUNA.edgeShadow)
      .rect(1, 1, this.width - 2, this.height - 2)
      .fill(LUNA.white);
    for (const lineY of separators) face.rect(2, lineY, this.width - 4, 1).fill(LUNA.edgeShadow);

    this.view.addChild(shadow, face, this.highlight, content);
    this.setHot(null);
  }

  /** Centre of an item in menu coordinates, for the virtual mouse */
  itemCenter(label: string): { x: number; y: number } {
    const item = this.items.find((i) => i.label === label);
    if (!item) throw new Error(`No menu item "${label}"`);
    return { x: TEXT_LEFT + 16, y: item.top + ITEM_HEIGHT / 2 };
  }

  /** Highlights the item under the mouse, or none with null; disabled items never highlight */
  setHot(label: string | null): void {
    const item = this.items.find((i) => i.label === label && !i.disabled) ?? null;
    if ((item?.label ?? null) === this.hot) return;
    this.hot = item?.label ?? null;
    this.highlight.clear();
    this.highlight.visible = item !== null;
    if (item) this.highlight.rect(2, item.top, this.width - 4, ITEM_HEIGHT).fill(LUNA.selection);
    for (const i of this.items) {
      const on = i === item;
      i.text.style.fill = on ? LUNA.white : i.disabled ? LUNA.inkDisabled : LUNA.ink;
      if (i.arrow) {
        const cx = this.width - 12;
        const cy = i.top + ITEM_HEIGHT / 2;
        i.arrow
          .clear()
          .poly([cx - 2, cy - 4, cx + 2, cy, cx - 2, cy + 4])
          .fill(on ? LUNA.white : LUNA.ink);
      }
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
