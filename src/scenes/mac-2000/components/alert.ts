// Alert (NSAlert): a pinstriped window with no title bar. 64 px application icon at the top left, bold message and
// 11 px informative text on the right, buttons at the bottom right with the default rightmost. Sized to its text;
// origin at the centre for scaling. Spacing per the original HIG: 20–24 px margins, 16 px icon gap, 12 px between buttons.

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { aquaText, drawWindowShadow, stripes, topRoundedRect } from './paint.ts';
import { PUSH_BUTTON_HEIGHT, PushButton, type PushButtonOptions } from './push-button.ts';

const ICON_SIZE = 64;
const MARGIN_X = 24;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 20;
const TEXT_X = MARGIN_X + ICON_SIZE + 16;
const BUTTON_GAP = 12;

export interface AquaAlertOptions {
  /** Application icon with its top left at (0, 0), 64 px square */
  icon: Container;
  /** Bold message: one sentence saying what happened */
  message: string;
  /** Small informative text */
  informative?: string;
  /** Left to right; the default button goes last */
  buttons: PushButtonOptions[];
  width?: number;
}

export class AquaAlert {
  readonly view: Container;
  readonly width: number;
  readonly height: number;
  /** Buttons, left to right; can take pointer events */
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

  /** Centre of the default (rightmost) button relative to the alert centre, in view coordinates */
  get defaultButtonCenter(): { x: number; y: number } {
    const button = this.buttons.at(-1);
    if (!button) return { x: 0, y: 0 };
    return {
      x: button.view.x + button.width / 2 - this.view.pivot.x,
      y: button.view.y + PUSH_BUTTON_HEIGHT / 2 - this.view.pivot.y,
    };
  }

  /** An alert that is not frontmost: its default button turns white and stops pulsing */
  setActive(active: boolean): void {
    for (const button of this.buttons) button.setActive(active);
  }

  /** Call every frame with the audio time (s) so the default button pulses */
  update(audioTime: number): void {
    for (const button of this.buttons) button.update(audioTime);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
