// Sheet (NSWindow beginSheet: with an NSAlert): a pinstriped panel sliding out below a document's title bar.
// Application icon top left, bold message and small text on the right; "Don't Save" alone on the left, the other
// buttons on the right with the default last. Origin at the middle of its top edge, placed at the title bar's bottom; setReveal() sets how far it is out.

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
  /** Application icon with its top left at (0, 0), 48 px square */
  icon: Container;
  message: string;
  informative?: string;
  /** A button on its own at the left (e.g. "Don't Save"); none if omitted */
  leftButton?: string;
  /** Buttons on the right, left to right; the last is the default */
  buttons: readonly string[];
  width: number;
}

export class AquaSheet {
  readonly view = new Container({ label: 'sheet' });
  readonly width: number;
  readonly height: number;
  /** Every button, by label */
  private readonly buttons = new Map<string, PushButton>();
  /** The panel itself, which moves as it slides */
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
      // A dark line along the top, as if it came out from under the title bar
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

    // Only what is below the top edge shows
    const mask = new Graphics()
      .rect(-width / 2 - 20, 0, width + 40, this.height + 30)
      .fill(0xffffff);
    this.view.addChild(this.panel, mask);
    this.panel.mask = mask;
  }

  /** How far it is out: 0 tucked under the title bar, 1 fully out */
  setReveal(progress: number): void {
    this.panel.y = -(1 - Math.min(1, Math.max(0, progress))) * this.height;
    this.view.visible = progress > 0;
  }

  /** Button centre relative to the top edge's middle, when fully out */
  buttonCenter(label: string): { x: number; y: number } {
    const button = this.buttons.get(label);
    if (!button) return { x: 0, y: this.height / 2 };
    return {
      x: this.panel.x + button.view.x + button.width / 2,
      y: button.view.y + PUSH_BUTTON_HEIGHT / 2,
    };
  }

  /** Shows the given button pressed (slightly darker) */
  setPressed(label: string | null): void {
    for (const [name, button] of this.buttons) button.view.alpha = name === label ? 0.7 : 1;
  }

  setActive(active: boolean): void {
    for (const button of this.buttons.values()) button.setActive(active);
  }

  /** Call every frame with the audio time (s) so the default button pulses */
  update(audioTime: number): void {
    for (const button of this.buttons.values()) button.update(audioTime);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
