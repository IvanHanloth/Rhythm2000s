// Horizontal slider (NSSlider, 10.0–10.2, no tick marks): a 5 px rounded grey groove and a round blue gel knob.
// Pressing the groove jumps the knob there; dragging follows the mouse. Origin at the top left.

import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawGelBall, vGradient } from './paint.ts';

const KNOB_RADIUS = 8;
const TRACK_HEIGHT = 5;
export const SLIDER_HEIGHT = KNOB_RADIUS * 2 + 4;

export class AquaSlider {
  readonly view = new Container({ label: 'slider' });
  readonly height = SLIDER_HEIGHT;
  private readonly knob = new Graphics();
  /** The knob centre travels between these x */
  private readonly left = KNOB_RADIUS;
  private readonly length: number;
  private fraction = 0;

  /** onChange gets the fraction (0–1) while pressing or dragging */
  constructor(width: number, onChange: (fraction: number) => void) {
    this.length = width - KNOB_RADIUS * 2;
    const s = AQUA.slider;
    const cy = SLIDER_HEIGHT / 2;
    const track = new Graphics()
      .roundRect(0, cy - TRACK_HEIGHT / 2, width, TRACK_HEIGHT, TRACK_HEIGHT / 2)
      .fill(s.trackDark)
      .roundRect(1, cy - TRACK_HEIGHT / 2 + 1, width - 2, TRACK_HEIGHT - 2, TRACK_HEIGHT / 2 - 1)
      .fill(
        vGradient([
          [0, s.trackDark],
          [1, s.trackLight],
        ]),
      );
    this.view.addChild(track, this.knob);

    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(-2, 0, width + 4, SLIDER_HEIGHT);
    this.view.on('pointerdown', (event: FederatedPointerEvent) => {
      const move = (e: FederatedPointerEvent) => onChange(this.fractionAt(e));
      const end = () => {
        this.view.off('globalpointermove', move);
        this.view.off('pointerup', end);
        this.view.off('pointerupoutside', end);
      };
      this.view.on('globalpointermove', move);
      this.view.on('pointerup', end);
      this.view.on('pointerupoutside', end);
      onChange(this.fractionAt(event));
    });
    this.draw();
  }

  setFraction(fraction: number): void {
    this.fraction = Math.min(1, Math.max(0, fraction));
    this.draw();
  }

  private fractionAt(event: FederatedPointerEvent): number {
    const { x } = event.getLocalPosition(this.view);
    return Math.min(1, Math.max(0, (x - this.left) / this.length));
  }

  private draw(): void {
    const x = this.left + this.fraction * this.length;
    drawGelBall(this.knob.clear(), x, SLIDER_HEIGHT / 2, KNOB_RADIUS, AQUA.slider.knob);
  }
}
