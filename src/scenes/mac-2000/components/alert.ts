// 提示框（NSAlert）：没有标题栏的细条纹窗口。左上 64 像素程序图标，右侧粗体主文字和 11 像素说明文字，
// 按钮靠右下排列，默认按钮在最右。大小随文字自动调整。原点在提示框中心，方便做缩放动画。
// 边距按原版人机界面指南：四周 20–24 像素，图标与文字之间 16 像素，按钮之间 12 像素。

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { aquaText, drawWindowShadow, stripes, topRoundedRect } from './paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton, type PushButtonOptions } from './push-button.ts';

const ICON_SIZE = 64;
const MARGIN_X = 24;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 20;
const TEXT_X = MARGIN_X + ICON_SIZE + 16;
const BUTTON_GAP = 12;

export interface AquaAlertOptions {
  /** 程序图标，左上角在 (0, 0)、边长 64 */
  icon: Container;
  /** 粗体主文字：一句话说清发生了什么 */
  message: string;
  /** 小字说明 */
  informative?: string;
  /** 从左到右排列；默认按钮放最后 */
  buttons: PushButtonOptions[];
  width?: number;
}

export class AquaAlert {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  /** 按钮，从左到右；可以挂鼠标事件 */
  readonly buttons: PushButton[];

  constructor({ icon, message, informative, buttons, width = 420 }: AquaAlertOptions) {
    this.view = new Container({ label: 'alert' });
    this.width = width;
    const wrapWidth = width - TEXT_X - MARGIN_X;

    const messageText = aquaText(message, { size: 13, bold: true, wrapWidth, lineHeight: 17 });
    messageText.position.set(TEXT_X, MARGIN_TOP);
    let textBottom = messageText.y + messageText.height;

    const parts: Container[] = [messageText];
    if (informative) {
      const info = aquaText(informative, { size: 11, wrapWidth, lineHeight: 14 });
      info.position.set(TEXT_X, textBottom + 8);
      textBottom = info.y + info.height;
      parts.push(info);
    }

    const buttonTop = Math.max(MARGIN_TOP + ICON_SIZE, textBottom) + 20;
    this.height = buttonTop + PUSH_BUTTON_HEIGHT + MARGIN_BOTTOM;
    this.view.pivot.set(width / 2, this.height / 2);

    icon.position.set(MARGIN_X, MARGIN_TOP);

    this.buttons = buttons.map((options) => new PushButton(options));
    let right = width - MARGIN_X;
    for (const button of [...this.buttons].reverse()) {
      right -= button.width;
      button.view.position.set(right, buttonTop);
      right -= BUTTON_GAP;
    }

    const body = topRoundedRect(new Graphics(), 0, 0, width, this.height, 6)
      .fill(stripes(AQUA.stripe))
      .stroke({ width: 1, color: AQUA.windowEdge, alpha: 0.55, alignment: 1 });

    this.view.addChild(
      drawWindowShadow(width, this.height, 0.55),
      body,
      icon,
      ...parts,
      ...this.buttons.map((b) => b.view),
    );
  }

  /** 默认按钮（最右边那个）的中心（以提示框中心为原点，与 view 的坐标一致） */
  get defaultButtonCenter(): { x: number; y: number } {
    const button = this.buttons.at(-1);
    if (!button) return { x: 0, y: 0 };
    return {
      x: button.view.x + button.width / 2 - this.view.pivot.x,
      y: button.view.y + PUSH_BUTTON_HEIGHT / 2 - this.view.pivot.y,
    };
  }

  /** 不在最前面的提示框：默认按钮变白、不再呼吸 */
  setActive(active: boolean): void {
    for (const button of this.buttons) button.setActive(active);
  }

  /** 每帧传入音频时间（秒），让默认按钮呼吸 */
  update(audioTime: number): void {
    for (const button of this.buttons) button.update(audioTime);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
