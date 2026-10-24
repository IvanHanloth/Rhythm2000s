// Luna 按钮：深蓝细边框、白到米色的渐变面、3 像素圆角。
// 默认按钮（按回车会触发的那个）带蓝色内框；鼠标悬停时内框变橙色；按下时面变暗。原点在左上角。

import { Container, Graphics } from 'pixi.js';
import { LUNA, type GradientStops } from '../../../theme/xp-luna.ts';
import { edgeRing, verticalGradient } from './draw.ts';
import { xpText } from './xp-text.ts';

export const BUTTON_WIDTH = 75;
export const BUTTON_HEIGHT = 23;
const RADIUS = 3;

export interface XpButtonOptions {
  label: string;
  width?: number;
  height?: number;
  /** 默认按钮：带蓝色内框 */
  isDefault?: boolean;
}

export class XpButton {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  private readonly face = new Graphics();
  private readonly isDefault: boolean;
  private hot = false;
  private pressed = false;

  constructor({
    label,
    width = BUTTON_WIDTH,
    height = BUTTON_HEIGHT,
    isDefault = false,
  }: XpButtonOptions) {
    this.width = width;
    this.height = height;
    this.isDefault = isDefault;
    this.view = new Container({ label: `button-${label}` });

    const text = xpText(label);
    text.anchor.set(0.5);
    text.position.set(Math.round(width / 2), Math.round(height / 2));
    this.view.addChild(this.face, text);
    this.redraw();
  }

  setHot(hot: boolean): void {
    if (this.hot === hot) return;
    this.hot = hot;
    this.redraw();
  }

  setPressed(pressed: boolean): void {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.redraw();
  }

  private redraw(): void {
    const { width: w, height: h } = this;
    const style = LUNA.button;
    const fill: GradientStops = this.pressed ? style.pressedFill : style.fill;
    const g = this.face.clear();
    g.roundRect(0, 0, w, h, RADIUS).fill(style.border);
    g.roundRect(1, 1, w - 2, h - 2, RADIUS - 1).fill(verticalGradient(fill));

    const rings = this.pressed
      ? null
      : this.hot
        ? style.hotRings
        : this.isDefault
          ? style.defaultRings
          : null;
    rings?.forEach(([top, sides, bottom], i) => {
      edgeRing(g, 1 + i, 1 + i, w - 2 - 2 * i, h - 2 - 2 * i, {
        top,
        left: sides,
        right: sides,
        bottom,
      });
    });
  }
}
