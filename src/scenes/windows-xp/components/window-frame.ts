// Luna window frame: blue title bar with two rounded corners, 3 px blue border, beige face; active and
// inactive colours. The red close button sits on the right (message boxes have only this one); ordinary
// windows like Explorer add blue minimise and maximise buttons and a 16 px program icon. Origin at the top left.

import { CanvasTextMetrics, Container, Graphics, Sprite, TextStyle, type Text } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
import { topRoundedRect, verticalGradient } from './draw.ts';
import { hardShadow, xpText, XP_FONTS } from './xp-text.ts';

export const CAPTION_HEIGHT = 29;
export const FRAME_WIDTH = 3;
const CORNER_RADIUS = 8;
const CLOSE_SIZE = 21;
const CAPTION_STYLE = { fontFamily: XP_FONTS.caption, fontSize: 13, fontWeight: '700' } as const;

/** Width of the title text, which sets the window's minimum width */
export function measureCaption(title: string): number {
  return CanvasTextMetrics.measureText(title, new TextStyle(CAPTION_STYLE)).width;
}

/** Titles that don't fit are cut off with "..." like the original */
function fitCaption(title: string, maxWidth: number): string {
  if (measureCaption(title) <= maxWidth) return title;
  let end = title.length;
  while (end > 0 && measureCaption(`${title.slice(0, end).trimEnd()}...`) > maxWidth) end--;
  return `${title.slice(0, end).trimEnd()}...`;
}

export interface XpWindowFrameOptions {
  title: string;
  width: number;
  height: number;
  /** Program icon left of the title (file name under assets/reference/windows-xp/icons/); none if omitted */
  icon?: string;
  /** close: only a close button (message boxes); all: minimise, maximise and close. Defaults to close */
  controls?: 'close' | 'all';
}

export class XpWindowFrame {
  readonly view: Container;
  /** Title bar close button; can take pointer events */
  readonly closeButton: CloseButton;
  private readonly active: Graphics;
  private readonly inactive: Graphics;
  private readonly titleText: Text;
  /** Room for the title: from its start to the leftmost caption button */
  private readonly titleMaxWidth: number;
  private readonly captionButtons: Container[] = [];
  private isActive = true;

  constructor({ title, width, height, icon, controls = 'close' }: XpWindowFrameOptions) {
    this.view = new Container({ label: `window-${title}` });
    this.active = drawFrame(width, height, true);
    this.inactive = drawFrame(width, height, false);
    this.inactive.visible = false;

    this.titleText = xpText(title, {
      ...CAPTION_STYLE,
      fill: LUNA.window.captionText,
      dropShadow: hardShadow(LUNA.window.captionTextShadow),
    });
    this.titleText.anchor.set(0, 0.5);
    this.titleText.position.set(icon ? 27 : 7, Math.round(CAPTION_HEIGHT / 2) + 1);
    this.view.addChild(this.active, this.inactive, this.titleText);

    if (icon) {
      const sprite = new Sprite(xpAssets().icon(icon));
      sprite.setSize(16);
      sprite.position.set(6, Math.round((CAPTION_HEIGHT - 16) / 2) + 1);
      this.view.addChild(sprite);
    }

    this.closeButton = new CloseButton();
    let x = width - FRAME_WIDTH - 2 - CLOSE_SIZE;
    this.closeButton.view.position.set(x, 4);
    this.captionButtons.push(this.closeButton.view);
    if (controls === 'all') {
      for (const glyph of ['maximize', 'minimize'] as const) {
        x -= CLOSE_SIZE + 2;
        const button = drawCaptionButton(glyph);
        button.position.set(x, 4);
        this.captionButtons.push(button);
      }
    }
    this.view.addChild(...this.captionButtons);
    this.titleMaxWidth = x - 4 - this.titleText.x;
    this.titleText.text = fitCaption(title, this.titleMaxWidth);
  }

  /** Changes the title (the download window's follows its progress) */
  setTitle(title: string): void {
    this.titleText.text = fitCaption(title, this.titleMaxWidth);
  }

  /** Active windows have a dark blue title bar; inactive ones pale blue-grey with a faded close button */
  setActive(active: boolean): void {
    if (this.isActive === active) return;
    this.isActive = active;
    this.active.visible = active;
    this.inactive.visible = !active;
    this.titleText.style.fill = active ? LUNA.window.captionText : LUNA.window.captionTextInactive;
    this.titleText.style.dropShadow = active ? hardShadow(LUNA.window.captionTextShadow) : false;
    for (const button of this.captionButtons) button.alpha = active ? 1 : 0.55;
  }
}

/** Blue minimise (a thick bar at the bottom left) and maximise (a box with a thick top) buttons */
function drawCaptionButton(glyph: 'minimize' | 'maximize'): Graphics {
  const s = CLOSE_SIZE;
  const c = LUNA.captionButton;
  const g = new Graphics({ label: glyph })
    .roundRect(0, 0, s, s, 3)
    .fill(c.border)
    .roundRect(1, 1, s - 2, s - 2, 2)
    .fill(verticalGradient(c.fill));
  if (glyph === 'minimize') {
    g.rect(5, 13, 7, 3).fill(c.glyph);
  } else {
    g.rect(5.5, 5.5, 10, 10).stroke({ width: 1, color: c.glyph }).rect(5, 5, 11, 3).fill(c.glyph);
  }
  return g;
}

function drawFrame(width: number, height: number, active: boolean): Graphics {
  const w = LUNA.window;
  const light = active ? w.frameLight : w.frameLightInactive;
  const dark = active ? w.frameDark : w.frameDarkInactive;
  const g = new Graphics();

  // Title bar: a 1 px light rim around a vertical gradient
  topRoundedRect(g, 0, 0, width, CAPTION_HEIGHT, CORNER_RADIUS).fill(
    active ? w.captionEdgeLight : w.captionEdgeLightInactive,
  );
  topRoundedRect(g, 1, 1, width - 2, CAPTION_HEIGHT - 1, CORNER_RADIUS - 1).fill(
    verticalGradient(active ? w.caption : w.captionInactive),
  );
  g.rect(width - 1, CORNER_RADIUS, 1, CAPTION_HEIGHT - CORNER_RADIUS).fill(dark[1]);

  // Left, right and bottom borders, 3 px each, three colours from outside in
  const bodyTop = CAPTION_HEIGHT;
  const bodyHeight = height - CAPTION_HEIGHT;
  for (let i = 0; i < FRAME_WIDTH; i++) {
    g.rect(i, bodyTop, 1, bodyHeight - i).fill(light[i]!);
    g.rect(width - 1 - i, bodyTop, 1, bodyHeight - i).fill(dark[i]!);
    g.rect(i + 1, height - 1 - i, width - 2 - 2 * i, 1).fill(dark[i]!);
  }

  g.rect(FRAME_WIDTH, bodyTop, width - FRAME_WIDTH * 2, bodyHeight - FRAME_WIDTH).fill(LUNA.face);
  return g;
}

/** 21×21 red close button: thin white rim, red gradient, bold white cross. Brighter on hover, darker when pressed. */
export class CloseButton {
  readonly view = new Container({ label: 'close-button' });
  private readonly highlight = new Graphics();

  constructor() {
    const s = CLOSE_SIZE;
    const c = LUNA.closeButton;
    const base = new Graphics()
      .roundRect(0, 0, s, s, 3)
      .fill(c.border)
      .roundRect(1, 1, s - 2, s - 2, 2)
      .fill(verticalGradient(c.fill))
      .moveTo(6, 6)
      .lineTo(s - 6, s - 6)
      .moveTo(s - 6, 6)
      .lineTo(6, s - 6)
      .stroke({ width: 2.2, color: c.glyph, cap: 'square' });
    this.highlight.roundRect(1, 1, s - 2, s - 2, 2).fill({ color: '#ffffff', alpha: 1 });
    this.highlight.visible = false;
    this.view.addChild(base, this.highlight);
  }

  /** hot: hovered; pressed: held down */
  setState(state: 'normal' | 'hot' | 'pressed'): void {
    this.highlight.visible = state !== 'normal';
    this.highlight.tint = state === 'hot' ? '#ffffff' : '#000000';
    this.highlight.alpha = state === 'hot' ? 0.22 : 0.18;
  }
}
