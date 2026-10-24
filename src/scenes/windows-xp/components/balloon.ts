// 托盘气泡提示（气泡样式的 tooltips_class32）：浅黄底、黑色细边、圆角，尖角指向托盘图标；
// 左上是 16 像素图标和粗体标题，右上角小关闭按钮，下面是正文。原点在尖角的尖端。

import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { xpAssets } from '@/scenes/windows-xp/assets.ts';
import { xpText } from './xp-text.ts';

const RADIUS = 7;
const PADDING = 10;
const STEM_HEIGHT = 18;
/** 尖角离气泡右边的距离 */
const STEM_RIGHT = 34;
const CLOSE_SIZE = 14;

export interface BalloonOptions {
  title: string;
  text: string;
  /** assets/reference/windows-xp/icons/ 下的图标名 */
  icon?: string;
  width?: number;
  onClose?: () => void;
}

export class XpBalloon {
  readonly view = new Container({ label: 'balloon' });
  /** 气泡连尖角的总高度：从尖端往上这么高 */
  readonly height: number;
  /** 关闭按钮中心（相对尖端），虚拟鼠标点这里 */
  readonly closeCenter: { x: number; y: number };
  /** 关闭按钮的悬停高亮，虚拟鼠标移上去时用 */
  readonly setCloseHot: (hot: boolean) => void;

  constructor({ title, text, icon = 'dialog-info', width = 270, onClose }: BalloonOptions) {
    const iconSprite = new Sprite(xpAssets().icon(icon));
    iconSprite.setSize(16);
    iconSprite.position.set(PADDING, PADDING);
    const titleText = xpText(title, { fontWeight: '700' });
    titleText.position.set(PADDING + 16 + 6, PADDING + 1);
    const body = xpText(text, {
      wordWrap: true,
      wordWrapWidth: width - PADDING * 2,
      breakWords: true,
      lineHeight: 16,
    });
    body.position.set(PADDING, PADDING + 16 + 8);
    const height = Math.ceil(body.y + body.height + PADDING);

    // 尖角：底边上一段斜着伸向右下
    const stemTipX = width - STEM_RIGHT;
    const stemBase = [stemTipX - 18, stemTipX - 2] as const;
    const shape = new Graphics()
      .roundRect(0, 0, width, height, RADIUS)
      .fill(LUNA.tooltip.fill)
      .stroke({ width: 1, color: LUNA.tooltip.border, alignment: 1 })
      .poly(
        [stemBase[0], height - 1, stemTipX, height + STEM_HEIGHT, stemBase[1], height - 1],
        false,
      )
      .fill(LUNA.tooltip.fill)
      .stroke({ width: 1, color: LUNA.tooltip.border })
      // 盖住尖角和气泡相接处的那段边线
      .rect(stemBase[0] + 1, height - 2, stemBase[1] - stemBase[0] - 2, 2)
      .fill(LUNA.tooltip.fill);

    const close = new Container({ label: 'balloon-close' });
    const closeFace = new Graphics();
    const drawClose = (hot: boolean) => {
      closeFace
        .clear()
        .roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 2)
        .fill(hot ? LUNA.closeButton.fill[2]![1] : '#f4f4ec')
        .stroke({ width: 1, color: hot ? '#ffffff' : '#c9c7ba', alignment: 1 })
        .moveTo(4, 4)
        .lineTo(CLOSE_SIZE - 4, CLOSE_SIZE - 4)
        .moveTo(CLOSE_SIZE - 4, 4)
        .lineTo(4, CLOSE_SIZE - 4)
        .stroke({ width: 1.6, color: hot ? '#ffffff' : '#4d4d4d' });
    };
    drawClose(false);
    close.addChild(closeFace);
    close.position.set(width - PADDING - CLOSE_SIZE + 3, PADDING - 3);
    close.eventMode = 'static';
    close.hitArea = new Rectangle(0, 0, CLOSE_SIZE, CLOSE_SIZE);
    close.on('pointerover', () => drawClose(true));
    close.on('pointerout', () => drawClose(false));
    close.on('pointertap', () => onClose?.());

    const content = new Container();
    content.addChild(shape, iconSprite, titleText, body, close);
    content.position.set(-stemTipX, -(height + STEM_HEIGHT));
    this.view.addChild(content);

    this.height = height + STEM_HEIGHT;
    this.closeCenter = {
      x: content.x + close.x + CLOSE_SIZE / 2,
      y: content.y + close.y + CLOSE_SIZE / 2,
    };
    this.setCloseHot = drawClose;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
