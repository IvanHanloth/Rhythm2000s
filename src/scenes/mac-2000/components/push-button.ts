// Push button (NSButton, push style): a 20 px gel capsule. The default button is blue and slowly pulses
// between light and dark like the original; other buttons are white.

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { aquaText, drawGelPill } from './paint.ts';

export const PUSH_BUTTON_HEIGHT = 20;
/** Minimum push button width from the original HIG */
const MIN_WIDTH = 69;
/** Padding either side of the label */
const PADDING = 14;
/** One pulse (s) */
const PULSE_SECONDS = 1.2;

export interface PushButtonOptions {
  label: string;
  /** Default button (triggered by Return): blue and pulsing */
  isDefault?: boolean;
  /** Sized to the label if omitted */
  width?: number;
}

export class PushButton {
  readonly view: Container;
  readonly width: number;
  /** Brighter layer the default button fades to while pulsing */
  private readonly glow: Graphics | null = null;
  /** The default button's blue look; white while its window is not frontmost */
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
      // Pulse: a brighter copy of the capsule, cross-faded by opacity
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

  /** As in the original, the default button turns white and stops pulsing when its window is not frontmost */
  setActive(active: boolean): void {
    if (!this.blue || !this.white) return;
    this.blue.visible = active;
    this.white.visible = !active;
  }

  /** Call every frame with the audio time (s) so the default button pulses; other buttons ignore it. */
  update(audioTime: number): void {
    if (!this.glow) return;
    const phase = (audioTime / PULSE_SECONDS) * Math.PI * 2;
    this.glow.alpha = 0.35 - 0.35 * Math.cos(phase);
  }
}
