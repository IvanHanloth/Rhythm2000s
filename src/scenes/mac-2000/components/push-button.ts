// 推按钮（NSButton 的 push button）：20 像素高的胶囊形果冻按钮。
// 默认按钮是蓝色，并且会缓慢「呼吸」（原版的默认按钮一直在明暗之间脉动）；其他按钮是白色。

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '../../../theme/aqua.ts';
import { aquaText, drawGelPill } from './paint.ts';

export const PUSH_BUTTON_HEIGHT = 20;
/** 原版人机界面指南里推按钮的最小宽度 */
const MIN_WIDTH = 69;
/** 文字两侧的留白 */
const PADDING = 14;
/** 呼吸一次的时长（秒） */
const PULSE_SECONDS = 1.2;

export interface PushButtonOptions {
  label: string;
  /** 默认按钮（按回车触发的那个）：蓝色、会呼吸 */
  isDefault?: boolean;
  /** 不传则按文字宽度自动算 */
  width?: number;
}

export class PushButton {
  readonly view: Container;
  readonly width: number;
  /** 默认按钮呼吸时叠在上面的亮层 */
  private readonly glow: Graphics | null = null;
  /** 默认按钮的蓝色外观；窗口不在最前面时换成白色 */
  private readonly blue: Container | null = null;
  private readonly white: Graphics | null = null;

  constructor({ label, isDefault = false, width }: PushButtonOptions) {
    this.view = new Container({ label: `button-${label}` });
    const text = aquaText(label, { size: 13 });
    this.width = width ?? Math.max(MIN_WIDTH, Math.ceil(text.width) + PADDING * 2);

    const white = drawGelPill(new Graphics(), 0, 0, this.width, PUSH_BUTTON_HEIGHT, AQUA.gel.white);
    this.view.addChild(white);

    if (isDefault) {
      const colors = AQUA.gel.blue;
      this.blue = new Container({ label: 'default' });
      // 呼吸：同样的胶囊再画一层更亮的，靠透明度在两者之间过渡
      this.glow = drawGelPill(new Graphics(), 0, 0, this.width, PUSH_BUTTON_HEIGHT, {
        ...colors,
        top: colors.mid,
      });
      this.glow.alpha = 0;
      this.blue.addChild(
        drawGelPill(new Graphics(), 0, 0, this.width, PUSH_BUTTON_HEIGHT, colors),
        this.glow,
      );
      this.view.addChild(this.blue);
      this.white = white;
      white.visible = false;
    }

    text.anchor.set(0.5);
    text.position.set(this.width / 2, PUSH_BUTTON_HEIGHT / 2);
    this.view.addChild(text);
  }

  /** 原版里窗口不在最前面时，默认按钮变成白色、不再呼吸 */
  setActive(active: boolean): void {
    if (!this.blue || !this.white) return;
    this.blue.visible = active;
    this.white.visible = !active;
  }

  /** 每帧传入音频时间（秒），让默认按钮呼吸。普通按钮不受影响。 */
  update(audioTime: number): void {
    if (!this.glow) return;
    const phase = (audioTime / PULSE_SECONDS) * Math.PI * 2;
    this.glow.alpha = 0.35 - 0.35 * Math.cos(phase);
  }
}
