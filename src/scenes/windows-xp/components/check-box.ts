// Luna check box (BS_AUTOCHECKBOX): a 13 px box with a dark blue border and a pale gradient face, a green tick
// when checked and an orange inner ring under the mouse; the label sits to its right. Origin at the top left.

import { Container, Graphics, Rectangle } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { verticalGradient } from './draw.ts';
import { xpText } from './xp-text.ts';

export const CHECK_BOX_SIZE = 13;

export class XpCheckBox {
  readonly view: Container;
  readonly width: number;
  readonly height = CHECK_BOX_SIZE;
  private readonly check = new Graphics();
  private readonly hot = new Graphics();
  private checked = false;

  /** onToggle runs on a click; the owner calls setChecked with the new value */
  constructor(label: string, onToggle: () => void) {
    this.view = new Container({ label: `check-box-${label}` });
    const s = CHECK_BOX_SIZE;
    const box = new Graphics()
      .rect(0, 0, s, s)
      .fill(LUNA.checkbox.border)
      .rect(1, 1, s - 2, s - 2)
      .fill(verticalGradient(LUNA.checkbox.fill));
    this.hot
      .rect(1.5, 1.5, s - 3, s - 3)
      .stroke({ width: 1.5, color: LUNA.checkbox.hot, alignment: 1 });
    this.hot.visible = false;
    const text = xpText(label);
    text.anchor.set(0, 0.5);
    text.position.set(s + 5, s / 2);
    this.width = s + 5 + Math.ceil(text.width);
    this.view.addChild(box, this.hot, this.check, text);

    this.view.eventMode = 'static';
    this.view.cursor = 'default';
    this.view.hitArea = new Rectangle(-2, -3, this.width + 4, s + 6);
    this.view.on('pointerover', () => (this.hot.visible = true));
    this.view.on('pointerout', () => (this.hot.visible = false));
    this.view.on('pointertap', onToggle);
  }

  setChecked(checked: boolean): void {
    if (checked === this.checked) return;
    this.checked = checked;
    this.check.clear();
    if (!checked) return;
    this.check
      .moveTo(3, 6)
      .lineTo(5.5, 8.5)
      .lineTo(10, 3.5)
      .stroke({ width: 2, color: LUNA.checkbox.check, cap: 'square', join: 'miter' });
  }
}
