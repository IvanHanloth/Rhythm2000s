// The narrow menu that drops from the menu bar volume extra (NSMenuExtra, Volume.menu): a vertical slider with a grey
// groove and a blue gel knob. Visual only; it never changes the game's volume. Origin at the top left, under the menu bar.
// drawSpeakerIcon() draws the black speaker on the menu bar.

import { Container, Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { drawGelBall, drawWindowShadow, hGradient, stripes } from './paint.ts';

export const VOLUME_MENU_WIDTH = 30;
const HEIGHT = 128;
const TRACK_TOP = 14;
const TRACK_BOTTOM = HEIGHT - 14;
const TRACK_WIDTH = 5;
const KNOB_RADIUS = 7;
const RADIUS = 5;

export class VolumeMenu {
  readonly view = new Container({ label: 'volume-menu' });
  readonly width = VOLUME_MENU_WIDTH;
  readonly height = HEIGHT;
  private readonly knob: Graphics;
  private readonly fill: Graphics;

  constructor() {
    const cx = VOLUME_MENU_WIDTH / 2;
    const body = new Graphics()
      .moveTo(0, 0)
      .lineTo(VOLUME_MENU_WIDTH, 0)
      .lineTo(VOLUME_MENU_WIDTH, HEIGHT - RADIUS)
      .arcTo(VOLUME_MENU_WIDTH, HEIGHT, VOLUME_MENU_WIDTH - RADIUS, HEIGHT, RADIUS)
      .lineTo(RADIUS, HEIGHT)
      .arcTo(0, HEIGHT, 0, HEIGHT - RADIUS, RADIUS)
      .closePath()
      .fill({ fill: stripes(AQUA.menuStripe), alpha: AQUA.menu.alpha })
      .stroke({ width: 1, color: AQUA.menu.edge, alpha: 0.35, alignment: 1 });
    const track = new Graphics()
      .roundRect(cx - TRACK_WIDTH / 2, TRACK_TOP, TRACK_WIDTH, TRACK_BOTTOM - TRACK_TOP, 2.5)
      .fill(
        hGradient([
          [0, AQUA.slider.trackDark],
          [1, AQUA.slider.trackLight],
        ]),
      );
    // Below the knob the groove is blue (the current volume)
    this.fill = new Graphics();
    this.knob = drawGelBall(new Graphics(), 0, 0, KNOB_RADIUS, AQUA.slider.knob);
    this.view.addChild(
      drawWindowShadow(VOLUME_MENU_WIDTH, HEIGHT, 0.4),
      body,
      track,
      this.fill,
      this.knob,
    );
    this.setLevel(1);
  }

  /** Slider position: 0 at the bottom, 1 at the top */
  setLevel(level: number): void {
    const center = this.knobCenter(level);
    this.knob.position.set(center.x, center.y);
    const cx = VOLUME_MENU_WIDTH / 2;
    this.fill
      .clear()
      .roundRect(cx - TRACK_WIDTH / 2, center.y, TRACK_WIDTH, TRACK_BOTTOM - center.y, 2.5)
      .fill({ color: AQUA.slider.knob.dark, alpha: 0.8 });
  }

  /** Knob centre (menu coordinates) */
  knobCenter(level: number): { x: number; y: number } {
    const clamped = Math.min(1, Math.max(0, level));
    const top = TRACK_TOP + KNOB_RADIUS - 2;
    const bottom = TRACK_BOTTOM - KNOB_RADIUS + 2;
    return { x: VOLUME_MENU_WIDTH / 2, y: bottom + (top - bottom) * clamped };
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

/**
 * The menu bar speaker: a speaker with three sound waves, none when muted. The white version goes on the blue open title.
 * Top left at (0, 0), about 18×16.
 */
export function drawSpeakerIcon({ muted = false, white = false } = {}): Graphics {
  const color = white ? AQUA.white : AQUA.ink;
  const g = new Graphics({ label: 'speaker-icon' })
    .poly([1, 6, 4, 6, 8, 2, 8, 14, 4, 10, 1, 10])
    .fill(color);
  if (!muted) {
    for (const r of [3, 6, 9]) {
      g.arc(8, 8, r, -Math.PI / 4, Math.PI / 4);
      g.stroke({ width: 1.3, color });
    }
  }
  return g;
}
