// 开始菜单（XP 样式）：顶部蓝色用户栏 + 橙色分隔线；左栏白底（固定项、常用程序、「All Programs」），
// 右栏浅蓝底（系统文件夹和工具）；底部蓝条「Log Off」「Turn Off Computer」。鼠标移上去是蓝底白字。
// 本地缺「Control Panel」「My Recent Documents」「Set Program Access and Defaults」的图标，这三项暂时不放。原点在左上角。

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { xpAssets } from '../assets.ts';
import { horizontalGradient, topRoundedRect, verticalGradient } from './draw.ts';
import { hardShadow, xpText } from './xp-text.ts';

export const START_MENU_WIDTH = 380;
const COLUMN_WIDTH = START_MENU_WIDTH / 2;
const HEADER_HEIGHT = 58;
const ACCENT_HEIGHT = 2;
const FOOTER_HEIGHT = 38;
const BODY_PADDING = 6;
const SEPARATOR_HEIGHT = 9;
const ALL_PROGRAMS_HEIGHT = 30;

interface ItemSpec {
  icon: string;
  label: string;
  /** 固定项的第二行灰字，如「Internet Explorer」 */
  subtitle?: string;
  bold?: boolean;
}

type Entry = ItemSpec | 'separator';

const PINNED: ItemSpec[] = [
  { icon: 'internet-explorer', label: 'Internet', subtitle: 'Internet Explorer', bold: true },
  { icon: 'outlook-express', label: 'E-mail', subtitle: 'Outlook Express', bold: true },
];
const FREQUENT: ItemSpec[] = [
  { icon: 'windows-media-player', label: 'Windows Media Player' },
  { icon: 'windows-messenger', label: 'Windows Messenger' },
  { icon: 'notepad', label: 'Notepad' },
  { icon: 'paint', label: 'Paint' },
  { icon: 'calculator', label: 'Calculator' },
  { icon: 'minesweeper', label: 'Minesweeper' },
];
const RIGHT: Entry[] = [
  { icon: 'my-documents', label: 'My Documents', bold: true },
  { icon: 'my-pictures', label: 'My Pictures', bold: true },
  { icon: 'my-music', label: 'My Music', bold: true },
  { icon: 'my-computer', label: 'My Computer', bold: true },
  'separator',
  { icon: 'network-global', label: 'My Network Places' },
  { icon: 'printer', label: 'Printers and Faxes' },
  'separator',
  { icon: 'help', label: 'Help and Support' },
  { icon: 'search', label: 'Search' },
  { icon: 'run', label: 'Run...' },
];

export interface StartMenuOptions {
  /** 点了某一项（菜单项、「All Programs」、「Log Off」「Turn Off Computer」） */
  onSelect?: (label: string) => void;
}

export class XpStartMenu {
  readonly view = new Container({ label: 'start-menu' });
  readonly width = START_MENU_WIDTH;
  readonly height: number;
  private readonly onSelect: (label: string) => void;
  /** 每一项：容器、鼠标热区（容器自己的坐标）、高亮开关 */
  private readonly items = new Map<
    string,
    { item: Container; hitArea: Rectangle; setHot: (on: boolean) => void }
  >();
  private highlighted: string | null = null;

  constructor({ onSelect = () => {} }: StartMenuOptions = {}) {
    this.onSelect = onSelect;
    const m = LUNA.startMenu;

    // ---- 左栏、右栏的内容，先排出高度 ----
    const left = new Container({ label: 'left' });
    let y = BODY_PADDING;
    for (const spec of PINNED) y = this.addItem(left, spec, y, 32, 42, 'left');
    y = addSeparator(left, y, m.leftSeparator);
    for (const spec of FREQUENT) y = this.addItem(left, spec, y, 32, 36, 'left');
    const leftContentHeight = y + SEPARATOR_HEIGHT + ALL_PROGRAMS_HEIGHT + BODY_PADDING;

    const right = new Container({ label: 'right' });
    right.position.set(COLUMN_WIDTH, 0);
    y = BODY_PADDING;
    for (const entry of RIGHT) {
      y =
        entry === 'separator'
          ? addSeparator(right, y, m.rightSeparator)
          : this.addItem(right, entry, y, 24, 26, 'right');
    }
    const bodyHeight = Math.max(leftContentHeight, y + BODY_PADDING);

    // 「所有程序」贴着左栏底部
    const allTop = bodyHeight - BODY_PADDING - ALL_PROGRAMS_HEIGHT;
    addSeparator(left, allTop - SEPARATOR_HEIGHT, m.leftSeparator);
    left.addChild(this.allPrograms(allTop));

    const bodyTop = HEADER_HEIGHT + ACCENT_HEIGHT;
    this.height = bodyTop + bodyHeight + FOOTER_HEIGHT;
    const w = START_MENU_WIDTH;

    // ---- 底色 ----
    const shadow = new Graphics()
      .rect(3, 6, w, this.height - 4)
      .fill({ color: '#000000', alpha: 0.18 })
      .rect(2, 4, w, this.height - 3)
      .fill({ color: '#000000', alpha: 0.18 });
    const face = new Graphics();
    topRoundedRect(face, 0, 0, w, HEADER_HEIGHT, 7).fill(verticalGradient(m.header));
    face.rect(0, HEADER_HEIGHT, w, ACCENT_HEIGHT).fill(horizontalGradient(m.accentLine));
    face.rect(0, bodyTop, COLUMN_WIDTH, bodyHeight).fill(m.left);
    face.rect(COLUMN_WIDTH, bodyTop, COLUMN_WIDTH, bodyHeight).fill(m.right);
    face.rect(COLUMN_WIDTH, bodyTop, 1, bodyHeight).fill(m.rightBorder);
    face.rect(0, bodyTop, 1, bodyHeight).fill(m.frame);
    face.rect(w - 1, bodyTop, 1, bodyHeight).fill(m.frame);
    face.rect(0, bodyTop + bodyHeight, w, FOOTER_HEIGHT).fill(verticalGradient(m.footer));

    left.y = bodyTop;
    right.y = bodyTop;

    this.view.addChild(shadow, face, this.header(), left, right, this.footer(bodyTop + bodyHeight));
  }

  /** 节奏关卡里虚拟鼠标停在哪一项：那一项蓝底白字，其余恢复；null 表示都不高亮 */
  highlight(label: string | null): void {
    if (label === this.highlighted) return;
    if (this.highlighted) this.items.get(this.highlighted)?.setHot(false);
    this.highlighted = label;
    if (label) this.items.get(label)?.setHot(true);
  }

  /** 某一项的中心（菜单自己的坐标），虚拟鼠标点这里；没有这一项时返回 null */
  itemCenter(label: string): { x: number; y: number } | null {
    const entry = this.items.get(label);
    if (!entry) return null;
    // 菜单里没有缩放，把一路上各层容器的位置加起来即可（不依赖还没渲染过的世界变换）
    const { x, y, width, height } = entry.hitArea;
    const center = { x: x + width / 2, y: y + height / 2 };
    for (let node: Container | null = entry.item; node && node !== this.view; node = node.parent) {
      center.x += node.x;
      center.y += node.y;
    }
    return center;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private header(): Container {
    const m = LUNA.startMenu;
    const header = new Container({ label: 'header' });
    const pictureSize = 44;
    const top = (HEADER_HEIGHT - pictureSize) / 2;
    const frame = new Graphics()
      .roundRect(7, top, pictureSize, pictureSize, 3)
      .fill({ color: '#dedede', alpha: 0.85 })
      .roundRect(9, top + 2, pictureSize - 4, pictureSize - 4, 2)
      .fill('#f4f8ff');
    const picture = new Sprite(xpAssets().icon('user'));
    picture.setSize(pictureSize - 8);
    picture.position.set(11, top + 4);
    const name = xpText('Administrator', {
      fontSize: 14,
      fontWeight: '700',
      fill: m.headerText,
      dropShadow: { ...hardShadow('#000000'), alpha: 0.7 },
    });
    name.anchor.set(0, 0.5);
    name.position.set(7 + pictureSize + 8, HEADER_HEIGHT / 2);
    header.addChild(frame, picture, name);
    return header;
  }

  private footer(top: number): Container {
    const footer = new Container({ label: 'footer' });
    footer.y = top;
    let right = START_MENU_WIDTH - 8;
    for (const { icon, label } of [
      { icon: 'shut-down', label: 'Turn Off Computer' },
      { icon: 'log-off', label: 'Log Off' },
    ]) {
      const item = new Container({ label: `footer-${label}` });
      const hot = new Graphics();
      const sprite = new Sprite(xpAssets().icon(icon));
      sprite.setSize(22);
      const text = xpText(label, { fill: LUNA.white });
      const width = 22 + 5 + Math.ceil(text.width) + 8;
      hot.roundRect(0, 4, width, FOOTER_HEIGHT - 8, 3).fill(LUNA.startMenu.footerHot);
      hot.visible = false;
      sprite.position.set(3, (FOOTER_HEIGHT - 22) / 2);
      text.anchor.set(0, 0.5);
      text.position.set(30, FOOTER_HEIGHT / 2);
      item.addChild(hot, sprite, text);
      right -= width;
      item.x = right;
      right -= 6;
      this.makeInteractive(item, label, new Rectangle(0, 4, width, FOOTER_HEIGHT - 8), (on) => {
        hot.visible = on;
      });
      footer.addChild(item);
    }
    return footer;
  }

  private allPrograms(top: number): Container {
    const item = new Container({ label: 'all-programs' });
    item.y = top;
    const hot = new Graphics()
      .rect(2, 0, COLUMN_WIDTH - 4, ALL_PROGRAMS_HEIGHT)
      .fill(LUNA.selection);
    hot.visible = false;
    const text = xpText('All Programs', { fontWeight: '700' });
    text.anchor.set(0, 0.5);
    const arrowSize = 17;
    const totalWidth = text.width + 8 + arrowSize;
    const x = Math.round((COLUMN_WIDTH - totalWidth) / 2) + 10;
    text.position.set(x, ALL_PROGRAMS_HEIGHT / 2);
    const arrow = new Graphics()
      .roundRect(0, 0, arrowSize, arrowSize, 3)
      .fill(verticalGradient(LUNA.startMenu.allProgramsArrow))
      .stroke({ width: 1, color: '#1d6b1d', alignment: 1 })
      .poly([6, 4, 12, 8.5, 6, 13])
      .fill(LUNA.white);
    arrow.position.set(x + text.width + 8, (ALL_PROGRAMS_HEIGHT - arrowSize) / 2);
    item.addChild(hot, text, arrow);
    this.makeInteractive(
      item,
      'All Programs',
      new Rectangle(2, 0, COLUMN_WIDTH - 4, ALL_PROGRAMS_HEIGHT),
      (on) => {
        hot.visible = on;
        text.style.fill = on ? LUNA.white : LUNA.ink;
      },
    );
    return item;
  }

  /** 加一个菜单项，返回下一项的 y */
  private addItem(
    column: Container,
    spec: ItemSpec,
    y: number,
    iconSize: number,
    height: number,
    side: 'left' | 'right',
  ): number {
    const item = new Container({ label: `item-${spec.label}` });
    item.y = y;
    const inset = side === 'left' ? 2 : 4;
    const width = COLUMN_WIDTH - inset * 2;
    const hot = new Graphics().rect(inset, 0, width, height).fill(LUNA.selection);
    hot.visible = false;

    const sprite = new Sprite(xpAssets().icon(spec.icon));
    sprite.setSize(iconSize);
    sprite.position.set(inset + 4, Math.round((height - iconSize) / 2));

    const textColor = side === 'right' ? LUNA.startMenu.rightText : LUNA.ink;
    const texts: { text: Text; color: string }[] = [];
    const title = xpText(spec.label, { fontWeight: spec.bold ? '700' : '400', fill: textColor });
    texts.push({ text: title, color: textColor });
    const textX = inset + 4 + iconSize + 6;
    if (spec.subtitle) {
      const subtitle = xpText(spec.subtitle, { fill: LUNA.startMenu.subtitle });
      title.position.set(textX, Math.round(height / 2) - 15);
      subtitle.position.set(textX, Math.round(height / 2) + 1);
      texts.push({ text: subtitle, color: LUNA.startMenu.subtitle });
      item.addChild(hot, sprite, title, subtitle);
    } else {
      title.anchor.set(0, 0.5);
      title.position.set(textX, Math.round(height / 2));
      item.addChild(hot, sprite, title);
    }

    this.makeInteractive(item, spec.label, new Rectangle(inset, 0, width, height), (on) => {
      hot.visible = on;
      for (const { text, color } of texts) text.style.fill = on ? LUNA.white : color;
    });
    column.addChild(item);
    return y + height;
  }

  private makeInteractive(
    item: Container,
    label: string,
    hitArea: Rectangle,
    setHot: (on: boolean) => void,
  ): void {
    this.items.set(label, { item, hitArea, setHot });
    item.eventMode = 'static';
    item.hitArea = hitArea;
    item.on('pointerover', () => setHot(true));
    item.on('pointerout', () => setHot(false));
    item.on('pointertap', () => {
      setHot(false);
      this.onSelect(label);
    });
  }
}

function addSeparator(
  column: Container,
  y: number,
  stops: typeof LUNA.startMenu.leftSeparator,
): number {
  const line = new Graphics()
    .rect(10, Math.floor(SEPARATOR_HEIGHT / 2), COLUMN_WIDTH - 20, 1)
    .fill(horizontalGradient(stops));
  line.y = y;
  column.addChild(line);
  return y + SEPARATOR_HEIGHT;
}
