// XP 风格的弹出窗口：蓝色渐变标题栏（只圆上方两个角）、右上角红色关闭按钮、米色内容区。
// 颜色全部取自主题 token，图形原创。原点在窗口中心，方便做缩放动画。

import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { FONT_FAMILIES, THEMES } from '../../theme/tokens.ts';

const theme = THEMES.xp;
const TITLE_HEIGHT = 30;
const FRAME = 3;
/** radius-xp-window */
const WINDOW_RADIUS = 8;
/** radius-xp-control */
const CONTROL_RADIUS = 3;
const CLOSE_SIZE = 22;

export interface PopupWindowOptions {
  title: string;
  body: string;
  width: number;
  height: number;
  /** 底部按钮的文字；不传则没有按钮 */
  button?: string;
}

export class PopupWindow {
  readonly view: Container;
  private readonly activeChrome: Graphics;
  private readonly inactiveChrome: Graphics;
  private readonly titleText: Text;
  private readonly titleFill: FillGradient;
  private active = true;

  constructor({ title, body, width, height, button }: PopupWindowOptions) {
    this.view = new Container({ label: `popup-${title}` });
    this.view.pivot.set(width / 2, height / 2);

    this.titleFill = new FillGradient({
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: theme.titlebarHi },
        { offset: 1, color: theme.titlebar },
      ],
    });

    // shadow-window：柔和投影
    const shadow = new Graphics()
      .roundRect(2, 3, width, height, WINDOW_RADIUS)
      .fill({ color: '#000000', alpha: 0.3 });

    this.activeChrome = drawChrome(width, height, this.titleFill, theme.titlebar);
    this.inactiveChrome = drawChrome(width, height, theme.titlebarInactive, theme.titlebarInactive);
    this.inactiveChrome.visible = false;

    const content = new Graphics()
      .rect(FRAME, TITLE_HEIGHT, width - FRAME * 2, height - TITLE_HEIGHT - FRAME)
      .fill(theme.surface);

    this.titleText = new Text({
      text: title,
      style: {
        fontFamily: FONT_FAMILIES.ui,
        fontSize: 15,
        fontWeight: '700',
        fill: theme.onTitlebar,
      },
    });
    this.titleText.anchor.set(0, 0.5);
    this.titleText.position.set(10, TITLE_HEIGHT / 2);

    const close = drawCloseButton(width - FRAME - 4 - CLOSE_SIZE, (TITLE_HEIGHT - CLOSE_SIZE) / 2);

    const bodyText = new Text({
      text: body,
      style: {
        fontFamily: FONT_FAMILIES.ui,
        fontSize: 15,
        lineHeight: 22,
        fill: theme.ink,
        wordWrap: true,
        wordWrapWidth: width - 40,
        breakWords: true,
      },
    });
    bodyText.position.set(20, TITLE_HEIGHT + 16);

    this.view.addChild(
      shadow,
      this.activeChrome,
      this.inactiveChrome,
      content,
      this.titleText,
      close,
      bodyText,
    );

    if (button) {
      this.view.addChild(drawButton(button, width / 2, height - FRAME - 22));
    }
  }

  /** 活动窗口用 titlebar 渐变；非活动窗口用 titlebar-inactive。 */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.activeChrome.visible = active;
    this.inactiveChrome.visible = !active;
    this.titleText.style.fill = active ? theme.onTitlebar : theme.onTitlebarInactive;
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.titleFill.destroy();
  }
}

/** 标题栏 + 窗口边框。标题栏只圆上方两个角：下方的圆角被随后画的边框盖住。 */
function drawChrome(
  width: number,
  height: number,
  titleFill: FillGradient | string,
  frameColor: string,
): Graphics {
  return new Graphics()
    .roundRect(0, 0, width, TITLE_HEIGHT + WINDOW_RADIUS, WINDOW_RADIUS)
    .fill(titleFill)
    .rect(0, TITLE_HEIGHT, width, height - TITLE_HEIGHT)
    .fill(frameColor);
}

/** 红色方块关闭按钮，× 是 2px 线条，颜色取 on-ctl。 */
function drawCloseButton(x: number, y: number): Graphics {
  const inset = 6;
  return new Graphics()
    .roundRect(x, y, CLOSE_SIZE, CLOSE_SIZE, CONTROL_RADIUS)
    .fill(theme.ctlClose)
    .stroke({ width: 1, color: theme.highlight, alignment: 1 })
    .moveTo(x + inset, y + inset)
    .lineTo(x + CLOSE_SIZE - inset, y + CLOSE_SIZE - inset)
    .moveTo(x + CLOSE_SIZE - inset, y + inset)
    .lineTo(x + inset, y + CLOSE_SIZE - inset)
    .stroke({ width: 2, color: theme.onCtl, cap: 'round' });
}

/** 系统风格的默认按钮（XP 蓝色内圈），中心在 (cx, cy)。 */
function drawButton(label: string, cx: number, cy: number): Container {
  const width = 88;
  const height = 26;
  const x = cx - width / 2;
  const y = cy - height / 2;
  const button = new Container({ label: `button-${label}` });

  const shape = new Graphics()
    .roundRect(x, y, width, height, CONTROL_RADIUS)
    .fill(theme.surfaceRaised)
    .stroke({ width: 1, color: theme.line, alignment: 1 })
    .roundRect(x + 2, y + 2, width - 4, height - 4, CONTROL_RADIUS)
    .stroke({ width: 1, color: theme.accent, alignment: 1 });

  const text = new Text({
    text: label,
    style: { fontFamily: FONT_FAMILIES.ui, fontSize: 13, fill: theme.ink },
  });
  text.anchor.set(0.5);
  text.position.set(cx, cy);

  button.addChild(shape, text);
  return button;
}
