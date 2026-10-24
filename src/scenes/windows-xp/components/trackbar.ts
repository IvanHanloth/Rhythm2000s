// Horizontal Luna trackbar (msctls_trackbar32), the volume control's slider laid on its side: a 4 px groove,
// ticks above and below, and a flat rounded thumb whose border turns orange under the mouse or while dragged.
// Clicking the groove jumps the thumb there. Origin at the top left.

import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { LUNA } from '@/theme/xp-luna.ts';
import { edgeRing, verticalGradient } from './draw.ts';

const THUMB_WIDTH = 11;
const THUMB_HEIGHT = 21;
export const TRACKBAR_HEIGHT = THUMB_HEIGHT + 8;

export class XpTrackbar {
  readonly view = new Container({ label: 'trackbar' });
  readonly height = TRACKBAR_HEIGHT;
  private readonly thumb = new Graphics();
  /** Thumb centre travels between these x */
  private readonly left = THUMB_WIDTH / 2;
  private readonly length: number;
  private fraction = 0;
  private hot = false;
  private dragging = false;

  /** `ticks` marks along the groove, ends included; onChange gets the fraction (0–1) while dragging */
  constructor(width: number, ticks: number, onChange: (fraction: number) => void) {
    this.length = width - THUMB_WIDTH;
    const cy = TRACKBAR_HEIGHT / 2;
    const t = LUNA.trackbar;
    const groove = new Graphics().rect(0, cy - 2, width, 4).fill(t.channelFill);
    edgeRing(groove, 0, cy - 2, width, 4, {
      top: t.channelDark,
      left: t.channelDark,
      right: t.channelLight,
      bottom: t.channelLight,
    });
    for (let i = 0; i < ticks; i++) {
      const x = Math.round(this.left + (i / (ticks - 1)) * this.length);
      const size = i === 0 || i === ticks - 1 || i === (ticks - 1) / 2 ? 4 : 3;
      groove.rect(x, cy - THUMB_HEIGHT / 2 - 1 - size, 1, size).fill(t.tick);
      groove.rect(x, cy + THUMB_HEIGHT / 2 + 1, 1, size).fill(t.tick);
    }
    this.view.addChild(groove, this.thumb);

    this.view.eventMode = 'static';
    this.view.hitArea = new Rectangle(-4, 0, width + 8, TRACKBAR_HEIGHT);
    this.view.on('pointerover', () => this.setHot(true));
    this.view.on('pointerout', () => this.setHot(false));
    this.view.on('pointerdown', (event: FederatedPointerEvent) => {
      this.dragging = true;
      const move = (e: FederatedPointerEvent) => onChange(this.fractionAt(e));
      const end = () => {
        this.view.off('globalpointermove', move);
        this.view.off('pointerup', end);
        this.view.off('pointerupoutside', end);
        this.dragging = false;
        this.draw();
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

  private setHot(hot: boolean): void {
    this.hot = hot;
    this.draw();
  }

  private draw(): void {
    const t = LUNA.trackbar;
    const x = Math.round(this.left + this.fraction * this.length - THUMB_WIDTH / 2);
    const y = (TRACKBAR_HEIGHT - THUMB_HEIGHT) / 2;
    this.thumb
      .clear()
      .roundRect(x, y, THUMB_WIDTH, THUMB_HEIGHT, 2)
      .fill(this.hot || this.dragging ? t.thumbBorderHot : t.thumbBorder)
      .roundRect(x + 1, y + 1, THUMB_WIDTH - 2, THUMB_HEIGHT - 2, 1)
      .fill(verticalGradient(t.thumbFill));
  }
}
