// 右键菜单（菜单窗口类 #32768，XP 平面菜单样式）：白底、1 像素灰边、右下有阴影；
// 鼠标所在的条目蓝底白字，不可用的条目灰字，有子菜单的条目右边一个黑色小三角。原点在菜单左上角。
// 桌面右键菜单的条目见 doc/scenes/windows-xp.md「桌面右键菜单与刷新」。

import { Container, Graphics, type Text } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpText } from './xp-text.ts';

export type MenuEntry = { label: string; submenu?: boolean; disabled?: boolean } | 'separator';

/** 中文版 XP 桌面空白处的右键菜单 */
export const DESKTOP_MENU: readonly MenuEntry[] = [
  { label: '排列图标(I)', submenu: true },
  { label: '刷新(E)' },
  'separator',
  { label: '粘贴(P)', disabled: true },
  { label: '粘贴快捷方式(S)', disabled: true },
  'separator',
  { label: '新建(W)', submenu: true },
  'separator',
  { label: '属性(R)' },
];

const ITEM_HEIGHT = 19;
const SEPARATOR_HEIGHT = 9;
/** 边框 + 上下留白 */
const PADDING = 3;
/** 文字左边留给勾选标记的位置 */
const TEXT_LEFT = 20;
/** 文字右边留给子菜单三角的位置 */
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
  /** 当前高亮的条目；undefined 表示还没画过 */
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

    // 平面菜单的阴影：右边和下边各一条渐淡的影子
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

  /** 某个条目的中心（菜单内坐标）；虚拟鼠标点它时用 */
  itemCenter(label: string): { x: number; y: number } {
    const item = this.items.find((i) => i.label === label);
    if (!item) throw new Error(`菜单里没有「${label}」`);
    return { x: TEXT_LEFT + 16, y: item.top + ITEM_HEIGHT / 2 };
  }

  /** 高亮鼠标所在的条目；null 表示没有。不可用的条目不高亮 */
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
