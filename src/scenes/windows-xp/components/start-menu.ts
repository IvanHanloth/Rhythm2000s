// XP Start menu: blue user bar with an orange rule; white left column (pinned, frequent, "All Programs"),
// light blue right column (system folders and tools); blue footer with "Log Off" and "Turn Off Computer".
// Hovered items are white on blue. Items without a local icon are left out, except "Control Panel" (it opens the
// settings, doc/settings.md), whose icon is drawn as vectors. "E-mail" opens Outlook Express (doc/easter-eggs.md).
// The footer items leave the computer. Origin at the top left.

import { Container, Graphics, Rectangle, Sprite, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
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

/** Label of the item that opens Outlook Express (doc/easter-eggs.md) */
export const E_MAIL = 'E-mail';
/** Label of the item that opens the settings window */
export const CONTROL_PANEL = 'Control Panel';
/** Footer items that leave the computer for the café */
export const LOG_OFF = 'Log Off';
export const TURN_OFF_COMPUTER = 'Turn Off Computer';
/** Icon name drawn by drawControlPanelIcon rather than loaded */
const CONTROL_PANEL_ICON = 'control-panel';

interface ItemSpec {
  /** File name under assets/reference/windows-xp/icons/, or CONTROL_PANEL_ICON */
  icon: string;
  label: string;
  /** Grey second line of a pinned item, e.g. "Internet Explorer" */
  subtitle?: string;
  bold?: boolean;
}

type Entry = ItemSpec | 'separator';

const PINNED: ItemSpec[] = [
  { icon: 'internet-explorer', label: 'Internet', subtitle: 'Internet Explorer', bold: true },
  { icon: 'outlook-express', label: E_MAIL, subtitle: 'Outlook Express', bold: true },
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
  { icon: CONTROL_PANEL_ICON, label: CONTROL_PANEL },
  { icon: 'printer', label: 'Printers and Faxes' },
  'separator',
  { icon: 'help', label: 'Help and Support' },
  { icon: 'search', label: 'Search' },
  { icon: 'run', label: 'Run...' },
];

export interface StartMenuOptions {
  /** An item was clicked (a menu item, "All Programs", "Log Off" or "Turn Off Computer") */
  onSelect?: (label: string) => void;
}

export class XpStartMenu {
  readonly view = new Container({ label: 'start-menu' });
  readonly width = START_MENU_WIDTH;
  readonly height: number;
  private readonly onSelect: (label: string) => void;
  /** Each item: container, hit area (in its own coordinates), highlight toggle */
  private readonly items = new Map<
    string,
    { item: Container; hitArea: Rectangle; setHot: (on: boolean) => void }
  >();
  private highlighted: string | null = null;

  constructor({ onSelect = () => {} }: StartMenuOptions = {}) {
    this.onSelect = onSelect;
    const m = LUNA.startMenu;

    // ---- Column contents, laid out first to get the height ----
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

    // "All Programs" sits at the bottom of the left column
    const allTop = bodyHeight - BODY_PADDING - ALL_PROGRAMS_HEIGHT;
    addSeparator(left, allTop - SEPARATOR_HEIGHT, m.leftSeparator);
    left.addChild(this.allPrograms(allTop));

    const bodyTop = HEADER_HEIGHT + ACCENT_HEIGHT;
    this.height = bodyTop + bodyHeight + FOOTER_HEIGHT;
    const w = START_MENU_WIDTH;

    // ---- Background ----
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

  /** Item the virtual mouse is on in a round: white on blue, the rest normal; null for none */
  highlight(label: string | null): void {
    if (label === this.highlighted) return;
    if (this.highlighted) this.items.get(this.highlighted)?.setHot(false);
    this.highlighted = label;
    if (label) this.items.get(label)?.setHot(true);
  }

  /** Centre of an item in menu coordinates, for the virtual mouse */
  itemCenter(label: string): { x: number; y: number } {
    const entry = this.items.get(label);
    if (!entry) throw new Error(`No Start menu item "${label}"`);
    // Nothing in the menu is scaled, so summing the container positions works before the first render
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
      { icon: 'shut-down', label: TURN_OFF_COMPUTER },
      { icon: 'log-off', label: LOG_OFF },
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

  /** Adds an item; returns the y of the next one */
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

    const sprite = itemIcon(spec.icon, iconSize);
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

function itemIcon(name: string, size: number): Container {
  if (name === CONTROL_PANEL_ICON) return drawControlPanelIcon(size);
  const sprite = new Sprite(xpAssets().icon(name));
  sprite.setSize(size);
  return sprite;
}

/**
 * Stand-in for the Control Panel icon, which isn't among the local assets: a small Luna window holding
 * coloured applet tiles and a slider, drawn on a 24 px grid and scaled to `size`.
 */
function drawControlPanelIcon(size: number): Container {
  const c = LUNA.startMenu.controlPanelIcon;
  const g = new Graphics()
    .roundRect(1, 3, 22, 19, 2)
    .fill(c.frame)
    .rect(2, 7, 20, 14)
    .fill(c.face)
    .rect(4, 9, 6, 5)
    .fill(c.tileRed)
    .rect(11, 9, 6, 5)
    .fill(c.tileGreen)
    .rect(4, 15, 6, 4)
    .fill(c.tileYellow)
    .rect(11, 16, 9, 2)
    .fill(c.slider)
    .rect(17, 14, 3, 6)
    .fill(c.frame)
    .rect(18, 9, 2, 5)
    .fill(c.tileGreen);
  const icon = new Container({ label: 'control-panel-icon' });
  icon.addChild(g);
  icon.scale.set(size / 24);
  return icon;
}
