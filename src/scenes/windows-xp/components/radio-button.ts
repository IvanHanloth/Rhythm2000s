// Luna radio button (BS_AUTORADIOBUTTON): a 13 px circle with the check box's dark blue border and pale gradient
// face, a green dot when selected and an orange inner ring under the mouse; the label sits to its right.
// Origin at the top left.

import { Container, Graphics, Rectangle } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { verticalGradient } from './draw.ts';
import { xpText } from './xp-text.ts';

export const RADIO_BUTTON_SIZE = 13;

export class XpRadioButton {
  readonly view: Container;
  readonly width: number;
  readonly height = RADIO_BUTTON_SIZE;
  private readonly dot = new Graphics();
  private readonly hot = new Graphics();
  private selected = false;

  /** onSelect runs on a click; the owner calls setSelected on every button of the group */
  constructor(label: string, onSelect: () => void) {
    this.view = new Container({ label: `radio-button-${label}` });
    const r = RADIO_BUTTON_SIZE / 2;
    const circle = new Graphics()
      .circle(r, r, r)
      .fill(LUNA.checkbox.border)
      .circle(r, r, r - 1)
      .fill(verticalGradient(LUNA.checkbox.fill));
    this.hot.circle(r, r, r - 2).stroke({ width: 1.5, color: LUNA.checkbox.hot, alignment: 1 });
    this.hot.visible = false;
    const text = xpText(label);
    text.anchor.set(0, 0.5);
    text.position.set(RADIO_BUTTON_SIZE + 5, r);
    this.width = RADIO_BUTTON_SIZE + 5 + Math.ceil(text.width);
    this.view.addChild(circle, this.hot, this.dot, text);

    this.view.eventMode = 'static';
    this.view.cursor = 'default';
    this.view.hitArea = new Rectangle(-2, -3, this.width + 4, RADIO_BUTTON_SIZE + 6);
    this.view.on('pointerover', () => (this.hot.visible = true));
    this.view.on('pointerout', () => (this.hot.visible = false));
    this.view.on('pointertap', onSelect);
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    this.dot.clear();
    if (!selected) return;
    const r = RADIO_BUTTON_SIZE / 2;
    this.dot.circle(r, r, 3).fill(LUNA.checkbox.check);
  }
}
