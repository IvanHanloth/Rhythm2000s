// 消息框（MessageBox，窗口类 #32770）：Luna 外框，左边 32 像素图标，右边正文，底部居中一排按钮。
// 大小随文字自动调整，和原版一样。原点在窗口中心，方便做弹出、关闭的缩放动画。

import { Container, Sprite } from 'pixi.js';
import { xpAssets } from '../assets.ts';
import { DIALOG_KINDS, type DialogKind } from '../dialog-kinds.ts';
import { BUTTON_HEIGHT, BUTTON_WIDTH, XpButton } from './button.ts';
import { CAPTION_HEIGHT, FRAME_WIDTH, measureCaption, XpWindowFrame } from './window-frame.ts';
import { xpText } from './xp-text.ts';

/** 客户区内边距 */
const PADDING = 11;
const ICON_SIZE = 32;
/** 图标和正文之间的距离 */
const ICON_GAP = 12;
const BUTTON_GAP = 6;
/** 正文和按钮之间的距离 */
const TEXT_BUTTON_GAP = 14;
const MIN_CLIENT_WIDTH = 160;

export interface XpMessageBoxOptions {
  kind: DialogKind;
  title: string;
  text: string;
  /** 不传时按消息框种类（「确定」或「是」「否」） */
  buttons?: readonly string[];
  /** 正文超过这个宽度就换行 */
  maxTextWidth?: number;
}

export class XpMessageBox {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  readonly frame: XpWindowFrame;
  readonly buttons: XpButton[];

  constructor({ kind, title, text, buttons, maxTextWidth = 300 }: XpMessageBoxOptions) {
    const info = DIALOG_KINDS[kind];
    const labels = buttons ?? info.buttons;

    const body = xpText(text, {
      wordWrap: true,
      wordWrapWidth: maxTextWidth,
      breakWords: true,
      lineHeight: 16,
    });
    this.buttons = labels.map((label, i) => new XpButton({ label, isDefault: i === 0 }));
    const buttonsWidth = labels.length * BUTTON_WIDTH + (labels.length - 1) * BUTTON_GAP;

    const textLeft = PADDING + ICON_SIZE + ICON_GAP;
    const contentHeight = Math.max(ICON_SIZE, Math.ceil(body.height));
    const titleWidth = measureCaption(title);
    const clientWidth = Math.ceil(
      Math.max(
        MIN_CLIENT_WIDTH,
        textLeft + body.width + PADDING + 8,
        buttonsWidth + PADDING * 2,
        titleWidth + 50,
      ),
    );
    const buttonsTop = PADDING + contentHeight + TEXT_BUTTON_GAP;
    const clientHeight = buttonsTop + BUTTON_HEIGHT + PADDING;

    this.width = clientWidth + FRAME_WIDTH * 2;
    this.height = CAPTION_HEIGHT + clientHeight + FRAME_WIDTH;
    this.view = new Container({ label: `${kind}-${title}` });
    this.view.pivot.set(Math.round(this.width / 2), Math.round(this.height / 2));

    this.frame = new XpWindowFrame({ title, width: this.width, height: this.height });

    const client = new Container({ label: 'client' });
    client.position.set(FRAME_WIDTH, CAPTION_HEIGHT);

    const icon = new Sprite(xpAssets().icon(info.icon));
    icon.setSize(ICON_SIZE);
    icon.position.set(PADDING, PADDING);

    // 一行字时和图标垂直居中，多行时从顶部排
    body.position.set(textLeft, PADDING + Math.max(0, Math.round((ICON_SIZE - body.height) / 2)));

    let x = Math.round((clientWidth - buttonsWidth) / 2);
    for (const button of this.buttons) {
      button.view.position.set(x, buttonsTop);
      x += BUTTON_WIDTH + BUTTON_GAP;
    }

    client.addChild(icon, body, ...this.buttons.map((b) => b.view));
    this.view.addChild(this.frame.view, client);
  }

  setActive(active: boolean): void {
    this.frame.setActive(active);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
