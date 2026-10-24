// Combo effects on the Mac desktop (doc/combo.md "Tiers"): tier 1 swells the Dock icons in a wave on each beat,
// tier 2 makes the menu bar and the Dock shelf glow on each beat, tier 3 flows iTunes-visualizer bands across the
// wallpaper. The glow and bands lie right over the wallpaper, under every window and the Dock, so nothing covers a
// target. A break of 10 or more shows the spinning wait cursor for a beat ("Combo break"). Drawn from beats and audio time.

import { Container, Graphics } from 'pixi.js';
import type { ComboTier } from '@/rhythm/combo.ts';
import { AQUA } from '@/theme/aqua.ts';
import { clamp01 } from '@/ui/easing.ts';
import { DOCK_HEIGHT, type Dock } from './components/dock.ts';
import { MENU_BAR_HEIGHT } from './components/menu-bar.ts';

/** Largest swell (0.14 = 14 % bigger) and how many icons wide the wave is */
const SWELL = 0.14;
const WAVE_WIDTH = 1.6;
/** The glow and bands fade in over this many beats */
const FADE_BEATS = 1;
const GLOW_LAYERS = 6;
const GLOW_REACH = 18;
/** Visualizer bands: centre line, height and how fast they flow */
const BAND_Y = 0.42;
const BAND_AMPLITUDE = 46;
const BAND_SPEED = 1.3;
const BAND_STEP = 16;
const BEACH_BALL_RADIUS = 11;

export interface MacComboEffectsOptions {
  dock: Dock;
  screenWidth: number;
  screenHeight: number;
}

export class MacComboEffects {
  /** Goes right over the wallpaper */
  readonly backLayer = new Container({ label: 'combo-effects' });
  /** The spinning wait cursor; the scene places it beside the hit counter, above everything */
  readonly beachBall: Graphics;
  private readonly options: MacComboEffectsOptions;
  private readonly glow = new Graphics();
  private readonly bands = new Graphics();
  /** Beat each tier was reached, by tier (index 0 unused); null while below it */
  private readonly reachedAt: (number | null)[] = [null, null, null, null];
  private brokeAt: number | null = null;

  constructor(options: MacComboEffectsOptions) {
    this.options = options;
    this.drawGlow();
    this.backLayer.addChild(this.bands, this.glow);
    this.glow.visible = false;
    this.beachBall = drawBeachBall();
    this.beachBall.visible = false;
  }

  /** A combo of 10 or more broke at heard time `audioTime` */
  showBreak(audioTime: number): void {
    this.brokeAt = audioTime;
  }

  update(tier: ComboTier, beat: number, audioTime: number, beatSeconds: number): void {
    for (let t = 1; t <= 3; t++) {
      if (tier < t) this.reachedAt[t] = null;
      else this.reachedAt[t] ??= beat;
    }
    const phase = beat - Math.floor(beat);
    const { dock } = this.options;

    // The wave crosses the Dock left to right during each beat, peaking on the first icon right on the beat
    const count = dock.iconCount;
    for (let i = 0; i < count; i++) {
      const distance = (phase * (count + WAVE_WIDTH) - i) / WAVE_WIDTH;
      const swell = tier >= 1 ? SWELL * Math.exp(-distance * distance * 2) : 0;
      dock.setSwell(i, swell);
    }

    const glowStart = this.reachedAt[2] ?? null;
    this.glow.visible = glowStart !== null;
    if (glowStart !== null) {
      const pulse = (1 - phase) ** 2;
      this.glow.alpha = clamp01((beat - glowStart) / FADE_BEATS) * (0.35 + 0.65 * pulse);
    }

    this.bands.clear();
    const bandStart = this.reachedAt[3] ?? null;
    if (bandStart !== null) {
      this.drawBands(audioTime, phase, clamp01((beat - bandStart) / FADE_BEATS));
    }

    const ball = this.brokeAt;
    this.beachBall.visible = ball !== null && audioTime - ball < beatSeconds;
    this.beachBall.rotation = audioTime * 14;
  }

  /** Puts the Dock back and hides everything (leaving a round) */
  clear(): void {
    this.reachedAt.fill(null);
    this.brokeAt = null;
    for (let i = 0; i < this.options.dock.iconCount; i++) this.options.dock.setSwell(i, 0);
    this.glow.visible = false;
    this.bands.clear();
    this.beachBall.visible = false;
  }

  destroy(): void {
    this.clear();
    this.backLayer.destroy({ children: true });
    this.beachBall.destroy();
  }

  /** Soft halos below the menu bar and around the Dock shelf, faked with stacked translucent shapes */
  private drawGlow(): void {
    const { dock, screenWidth, screenHeight } = this.options;
    const color = AQUA.combo.glow;
    const alpha = 0.5 / GLOW_LAYERS;
    const dockX = dock.view.x;
    const dockTop = screenHeight - DOCK_HEIGHT;
    for (let i = 1; i <= GLOW_LAYERS; i++) {
      const reach = (GLOW_REACH * i) / GLOW_LAYERS;
      this.glow
        .rect(0, MENU_BAR_HEIGHT, screenWidth, reach)
        .fill({ color, alpha })
        .roundRect(
          dockX - reach,
          dockTop - reach,
          dock.width + reach * 2,
          DOCK_HEIGHT + reach,
          8 + reach,
        )
        .fill({ color, alpha });
    }
  }

  private drawBands(audioTime: number, phase: number, fade: number): void {
    const { screenWidth, screenHeight } = this.options;
    const kick = 1 + 0.35 * (1 - phase) ** 2;
    AQUA.combo.bands.forEach((color, i) => {
      const center = screenHeight * BAND_Y + (i - 1.5) * 22;
      const offset = audioTime * BAND_SPEED * (1 + i * 0.25) + i * 1.7;
      const points: number[] = [];
      for (let x = -BAND_STEP; x <= screenWidth + BAND_STEP; x += BAND_STEP) {
        const wave = Math.sin(x / 140 + offset) + 0.5 * Math.sin(x / 61 - offset * 1.4);
        points.push(x, center + wave * BAND_AMPLITUDE * kick * 0.6);
      }
      this.bands
        .poly(points, false)
        .stroke({ width: 16, color, alpha: 0.22 * fade, join: 'round' });
      this.bands.poly(points, false).stroke({ width: 3, color, alpha: 0.7 * fade, join: 'round' });
    });
  }
}

/** The spinning wait cursor: six coloured wedges in a grey ring, centred on the origin */
function drawBeachBall(): Graphics {
  const g = new Graphics({ label: 'beach-ball' });
  const colors = AQUA.combo.beachBall;
  const step = (Math.PI * 2) / colors.length;
  colors.forEach((color, i) => {
    g.moveTo(0, 0)
      .arc(0, 0, BEACH_BALL_RADIUS, i * step, (i + 1) * step)
      .closePath()
      .fill(color);
  });
  g.circle(0, 0, BEACH_BALL_RADIUS).stroke({ width: 1.2, color: AQUA.combo.beachBallEdge });
  return g;
}
