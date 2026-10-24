// 表单（NSWindow beginSheet:，内容是 NSAlert）：从文稿窗口标题栏下方滑出的细条纹面板。
// 左上程序图标，右侧粗体主文字和小字说明；「Don't Save」靠左，其余按钮靠右，默认按钮在最右。
// 原点在面板上沿中点，放在窗口标题栏下沿；setReveal() 控制滑出了多少（上沿以上的部分被裁掉）。

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { aquaText, drawWindowShadow, stripes } from './paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton } from './push-button.ts';

const ICON_SIZE = 48;
const MARGIN_X = 18;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 16;
const TEXT_X = MARGIN_X + ICON_SIZE + 14;
const BUTTON_GAP = 10;

export interface AquaSheetOptions {
  /** 程序图标，左上角在 (0, 0)、边长 48 */
  icon: Container;
  message: string;
  informative?: string;
  /** 靠左单放的按钮（例如「Don't Save」）；不传则没有 */
  leftButton?: string;
  /** 靠右排列的按钮，从左到右；最后一个是默认按钮 */
  buttons: readonly string[];
  width: number;
}

export class AquaSheet {
  readonly view = new Container({ label: 'sheet' });
  readonly width: number;
  readonly height: number;
  /** 全部按钮，按文字找 */
  private readonly buttons = new Map<string, PushButton>();
  /** 面板本体：滑出时上下移动 */
  private readonly panel = new Container({ label: 'sheet-panel' });

  constructor({ icon, message, informative, leftButton, buttons, width }: AquaSheetOptions) {
    this.width = width;
    const wrapWidth = width - TEXT_X - MARGIN_X;
    const messageText = aquaText(message, { size: 13, bold: true, wrapWidth, lineHeight: 17 });
    messageText.position.set(TEXT_X, MARGIN_TOP);
    let textBottom = messageText.y + messageText.height;
    const parts: Container[] = [messageText];
    if (informative) {
      const info = aquaText(informative, { size: 11, wrapWidth, lineHeight: 14 });
      info.position.set(TEXT_X, textBottom + 6);
      textBottom = info.y + info.height;
      parts.push(info);
    }

    const buttonTop = Math.max(MARGIN_TOP + ICON_SIZE, textBottom) + 16;
    this.height = buttonTop + PUSH_BUTTON_HEIGHT + MARGIN_BOTTOM;

    let right = width - MARGIN_X;
    [...buttons].reverse().forEach((label, i) => {
      const button = new PushButton({ label, isDefault: i === 0 });
      right -= button.width;
      button.view.position.set(right, buttonTop);
      right -= BUTTON_GAP;
      this.buttons.set(label, button);
    });
    if (leftButton) {
      const button = new PushButton({ label: leftButton });
      button.view.position.set(MARGIN_X, buttonTop);
      this.buttons.set(leftButton, button);
    }

    icon.position.set(MARGIN_X, MARGIN_TOP);
    const body = new Graphics()
      .rect(0, 0, width, this.height)
      .fill(stripes(AQUA.stripe))
      .rect(0, 0, width, this.height)
      .stroke({ width: 1, color: AQUA.windowEdge, alpha: 0.45, alignment: 1 })
      // 上沿一道暗线，像是从标题栏下面钻出来
      .rect(0, 0, width, 2)
      .fill({ color: AQUA.shadow, alpha: 0.18 });

    this.panel.addChild(
      drawWindowShadow(width, this.height, 0.45),
      body,
      icon,
      ...parts,
      ...[...this.buttons.values()].map((b) => b.view),
    );
    this.panel.x = -width / 2;

    // 只露出上沿以下的部分
    const mask = new Graphics()
      .rect(-width / 2 - 20, 0, width + 40, this.height + 30)
      .fill(0xffffff);
    this.view.addChild(this.panel, mask);
    this.panel.mask = mask;
  }

  /** 滑出了多少：0 完全收在标题栏下面，1 完全滑出 */
  setReveal(progress: number): void {
    this.panel.y = -(1 - Math.min(1, Math.max(0, progress))) * this.height;
    this.view.visible = progress > 0;
  }

  /** 按钮中心（以面板上沿中点为原点，完全滑出时） */
  buttonCenter(label: string): { x: number; y: number } {
    const button = this.buttons.get(label);
    if (!button) return { x: 0, y: this.height / 2 };
    return {
      x: this.panel.x + button.view.x + button.width / 2,
      y: button.view.y + PUSH_BUTTON_HEIGHT / 2,
    };
  }

  /** 按下的按钮显示成按下（稍暗） */
  setPressed(label: string | null): void {
    for (const [name, button] of this.buttons) button.view.alpha = name === label ? 0.7 : 1;
  }

  setActive(active: boolean): void {
    for (const button of this.buttons.values()) button.setActive(active);
  }

  /** 每帧传入音频时间（秒），让默认按钮呼吸 */
  update(audioTime: number): void {
    for (const button of this.buttons.values()) button.update(audioTime);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
