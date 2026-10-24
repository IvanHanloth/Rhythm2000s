// Luna 窗口外框：上方两个圆角的蓝色标题栏、3 像素宽的蓝色边框、米色窗口底；
// 活动 / 非活动两套颜色。标题栏右边是红色关闭按钮（消息框只有这一个按钮）。原点在左上角。

import { CanvasTextMetrics, Container, Graphics, TextStyle, type Text } from 'pixi.js';
import { LUNA } from '../../../theme/xp-luna.ts';
import { topRoundedRect, verticalGradient } from './draw.ts';
import { hardShadow, xpText, XP_FONTS } from './xp-text.ts';

export const CAPTION_HEIGHT = 29;
export const FRAME_WIDTH = 3;
const CORNER_RADIUS = 8;
const CLOSE_SIZE = 21;
const CAPTION_STYLE = { fontFamily: XP_FONTS.caption, fontSize: 13, fontWeight: '700' } as const;

/** 标题文字的宽度，用来决定窗口至少多宽 */
export function measureCaption(title: string): number {
  return CanvasTextMetrics.measureText(title, new TextStyle(CAPTION_STYLE)).width;
}

export interface XpWindowFrameOptions {
  title: string;
  width: number;
  height: number;
}

export class XpWindowFrame {
  readonly view: Container;
  /** 标题栏关闭按钮，可以挂鼠标事件 */
  readonly closeButton: CloseButton;
  private readonly active: Graphics;
  private readonly inactive: Graphics;
  private readonly titleText: Text;
  private isActive = true;

  constructor({ title, width, height }: XpWindowFrameOptions) {
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
    this.titleText.position.set(7, Math.round(CAPTION_HEIGHT / 2) + 1);

    this.closeButton = new CloseButton();
    this.closeButton.view.position.set(width - FRAME_WIDTH - 2 - CLOSE_SIZE, 4);

    this.view.addChild(this.active, this.inactive, this.titleText, this.closeButton.view);
  }

  /** 活动窗口是深蓝标题栏；非活动窗口是浅蓝灰，关闭按钮变淡 */
  setActive(active: boolean): void {
    if (this.isActive === active) return;
    this.isActive = active;
    this.active.visible = active;
    this.inactive.visible = !active;
    this.titleText.style.fill = active ? LUNA.window.captionText : LUNA.window.captionTextInactive;
    this.titleText.style.dropShadow = active ? hardShadow(LUNA.window.captionTextShadow) : false;
    this.closeButton.view.alpha = active ? 1 : 0.55;
  }
}

function drawFrame(width: number, height: number, active: boolean): Graphics {
  const w = LUNA.window;
  const light = active ? w.frameLight : w.frameLightInactive;
  const dark = active ? w.frameDark : w.frameDarkInactive;
  const g = new Graphics();

  // 标题栏：外圈 1 像素亮边，里面是竖向渐变
  topRoundedRect(g, 0, 0, width, CAPTION_HEIGHT, CORNER_RADIUS).fill(
    active ? w.captionEdgeLight : w.captionEdgeLightInactive,
  );
  topRoundedRect(g, 1, 1, width - 2, CAPTION_HEIGHT - 1, CORNER_RADIUS - 1).fill(
    verticalGradient(active ? w.caption : w.captionInactive),
  );
  g.rect(width - 1, CORNER_RADIUS, 1, CAPTION_HEIGHT - CORNER_RADIUS).fill(dark[1]);

  // 左、右、下三条边框，每条 3 像素，从外到内三种颜色
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

/** 21×21 的红色关闭按钮：白色细边、红色渐变、白色粗叉。悬停时变亮，按下时变暗。 */
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

  /** hot：鼠标悬停；pressed：按下 */
  setState(state: 'normal' | 'hot' | 'pressed'): void {
    this.highlight.visible = state !== 'normal';
    this.highlight.tint = state === 'hot' ? '#ffffff' : '#000000';
    this.highlight.alpha = state === 'hot' ? 0.22 : 0.18;
  }
}
