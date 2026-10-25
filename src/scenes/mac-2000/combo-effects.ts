// Combo effects on the Mac desktop (doc/combo.md "Tiers"): tier 1 sends Aqua bubbles up the wallpaper, tier 2 makes
// the menu bar and the Dock shelf glow on each beat, tier 3 dims the wallpaper for the Flurry screen saver's ribbons.
// Nothing moves the Dock icons, since that is the dock-bounce action. Everything lies right over the wallpaper, under
// every window and the Dock, so nothing covers a target. A break of COMBO_BREAK_MIN or more shows the spinning wait
// cursor for a beat ("Combo break"). Drawn from beats and audio time.

import { Container, Graphics } from 'pixi.js';
import type { EffectTier } from '@/rhythm/combo.ts';
import { AQUA } from '@/theme/aqua.ts';
import { clamp01 } from '@/ui/easing.ts';
import { bubblesAt, drawBubbles } from './aqua-bubbles.ts';
import { DOCK_HEIGHT, type Dock } from './components/dock.ts';
import { MENU_BAR_HEIGHT } from './components/menu-bar.ts';
import { Flurry } from './flurry.ts';

/** Each effect fades in over this many beats */
const FADE_BEATS = 1;
const GLOW_LAYERS = 6;
const GLOW_REACH = 18;
/** Gap between the bubbles and the menu bar and Dock (px) */
const BUBBLE_MARGIN = 6;
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
  private readonly bubbles = new Graphics();
  private readonly glow = new Graphics();
  private readonly flurry: Flurry;
  /** Beat each tier was reached, by tier (index 0 unused); null while below it */
  private readonly reachedAt: (number | null)[] = [null, null, null, null];
  private brokeAt: number | null = null;

  constructor(options: MacComboEffectsOptions) {
    this.options = options;
    this.flurry = new Flurry(options.screenWidth, options.screenHeight);
    this.drawGlow();
    this.backLayer.addChild(this.flurry.view, this.bubbles, this.glow);
    this.flurry.view.visible = false;
    this.glow.visible = false;
    this.beachBall = drawBeachBall();
    this.beachBall.visible = false;
  }

  /** A combo of COMBO_BREAK_MIN or more broke at heard time `audioTime` */
  showBreak(audioTime: number): void {
    this.brokeAt = audioTime;
  }

  /** Draws the effects of `tiers` (in a round, every tier reached: tierEffects) and the beach ball after a break */
  update(tiers: readonly EffectTier[], beat: number, audioTime: number, beatSeconds: number): void {
    for (const t of [1, 2, 3] as const) {
      if (!tiers.includes(t)) this.reachedAt[t] = null;
      else this.reachedAt[t] ??= beat;
    }
    const phase = beat - Math.floor(beat);
    const { screenWidth, screenHeight } = this.options;

    this.bubbles.clear();
    const bubbleStart = this.reachedAt[1] ?? null;
    if (bubbleStart !== null) {
      const area = {
        width: screenWidth,
        top: MENU_BAR_HEIGHT + BUBBLE_MARGIN,
        bottom: screenHeight - DOCK_HEIGHT - BUBBLE_MARGIN,
      };
      const fade = clamp01((beat - bubbleStart) / FADE_BEATS);
      drawBubbles(this.bubbles, bubblesAt(bubbleStart, beat, area), fade);
    }

    const glowStart = this.reachedAt[2] ?? null;
    this.glow.visible = glowStart !== null;
    if (glowStart !== null) {
      const pulse = (1 - phase) ** 2;
      this.glow.alpha = clamp01((beat - glowStart) / FADE_BEATS) * (0.35 + 0.65 * pulse);
    }

    const flurryStart = this.reachedAt[3] ?? null;
    this.flurry.view.visible = flurryStart !== null;
    if (flurryStart !== null) {
      this.flurry.update(beat, audioTime, clamp01((beat - flurryStart) / FADE_BEATS));
    }

    const ball = this.brokeAt;
    this.beachBall.visible = ball !== null && audioTime - ball < beatSeconds;
    this.beachBall.rotation = audioTime * 14;
  }

  /** Hides everything (leaving a round) */
  clear(): void {
    this.reachedAt.fill(null);
    this.brokeAt = null;
    this.bubbles.clear();
    this.glow.visible = false;
    this.flurry.view.visible = false;
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
