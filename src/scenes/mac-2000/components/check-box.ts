// Check box (NSButton, switch style, 10.0–10.2): a 14 px rounded gel square, white when off and blue gel with a
// black tick when on; pressing dims it. The 13 px label sits to its right. Origin at the top left.

import { Container, Graphics, Rectangle } from 'pixi.js';
import { AQUA, type GelColors } from '@/theme/aqua.ts';
import { aquaText, vGradient } from './paint.ts';

export const CHECK_BOX_SIZE = 14;

export class AquaCheckBox {
  readonly view: Container;
  readonly width: number;
  readonly height = CHECK_BOX_SIZE;
  private readonly box = new Graphics();
  private checked: boolean | null = null;

  /** onToggle runs on a click; the owner calls setChecked with the new value */
  constructor(label: string, onToggle: () => void) {
    this.view = new Container({ label: `check-box-${label}` });
    const text = aquaText(label, { size: 13 });
    text.anchor.set(0, 0.5);
    text.position.set(CHECK_BOX_SIZE + 6, CHECK_BOX_SIZE / 2);
    this.width = CHECK_BOX_SIZE + 6 + Math.ceil(text.width);
    this.view.addChild(this.box, text);
    this.setChecked(false);

    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(-2, -3, this.width + 4, CHECK_BOX_SIZE + 6);
    this.view.on('pointerdown', () => (this.box.alpha = 0.75));
    this.view.on('pointerout', () => (this.box.alpha = 1));
    this.view.on('pointertap', () => {
      this.box.alpha = 1;
      onToggle();
    });
  }

  setChecked(checked: boolean): void {
    if (checked === this.checked) return;
    this.checked = checked;
    const s = CHECK_BOX_SIZE;
    const colors: GelColors = checked ? AQUA.gel.blue : AQUA.gel.white;
    this.box
      .clear()
      .roundRect(0, 1, s, s, 3)
      .fill({ color: AQUA.shadow, alpha: 0.16 })
      .roundRect(0, 0, s, s, 3)
      .fill(colors.rim)
      .roundRect(1, 1, s - 2, s - 2, 2)
      .fill(
        vGradient([
          [0, colors.top],
          [0.5, colors.mid],
          [1, colors.glow],
        ]),
      )
      .roundRect(2.5, 1.5, s - 5, s * 0.42, 2)
      .fill({ color: AQUA.white, alpha: 0.55 });
    if (!checked) return;
    this.box
      .moveTo(3.5, 7)
      .lineTo(6, 10.5)
      .lineTo(11.5, 2.5)
      .stroke({ width: 2, color: AQUA.ink, cap: 'round', join: 'round' });
  }
}
