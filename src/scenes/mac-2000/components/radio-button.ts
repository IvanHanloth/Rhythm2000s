// Radio button (NSButton, radio style, 10.0–10.2): a 14 px round gel, white when off and blue gel with a dark dot
// when on, like the check box; pressing dims it. The 13 px label sits to its right. Origin at the top left.

import { Container, Graphics, Rectangle } from 'pixi.js';
import { AQUA, type GelColors } from '@/theme/aqua.ts';
import { aquaText, vGradient } from './paint.ts';

export const RADIO_BUTTON_SIZE = 14;

export class AquaRadioButton {
  readonly view: Container;
  readonly width: number;
  readonly height = RADIO_BUTTON_SIZE;
  private readonly button = new Graphics();
  private selected: boolean | null = null;

  /** onSelect runs on a click; the owner calls setSelected on every button of the group */
  constructor(label: string, onSelect: () => void) {
    this.view = new Container({ label: `radio-button-${label}` });
    const text = aquaText(label, { size: 13 });
    text.anchor.set(0, 0.5);
    text.position.set(RADIO_BUTTON_SIZE + 6, RADIO_BUTTON_SIZE / 2);
    this.width = RADIO_BUTTON_SIZE + 6 + Math.ceil(text.width);
    this.view.addChild(this.button, text);
    this.setSelected(false);

    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(-2, -3, this.width + 4, RADIO_BUTTON_SIZE + 6);
    this.view.on('pointerdown', () => (this.button.alpha = 0.75));
    this.view.on('pointerout', () => (this.button.alpha = 1));
    this.view.on('pointertap', () => {
      this.button.alpha = 1;
      onSelect();
    });
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    const r = RADIO_BUTTON_SIZE / 2;
    const colors: GelColors = selected ? AQUA.gel.blue : AQUA.gel.white;
    this.button
      .clear()
      .circle(r, r + 1, r)
      .fill({ color: AQUA.shadow, alpha: 0.16 })
      .circle(r, r, r)
      .fill(colors.rim)
      .circle(r, r, r - 1)
      .fill(
        vGradient([
          [0, colors.top],
          [0.5, colors.mid],
          [1, colors.glow],
        ]),
      )
      .ellipse(r, r * 0.55, r * 0.62, r * 0.38)
      .fill({ color: AQUA.white, alpha: 0.55 });
    if (!selected) return;
    this.button.circle(r, r, 3).fill(AQUA.ink);
  }
}
