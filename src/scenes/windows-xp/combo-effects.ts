// Combo effects on the XP desktop (doc/combo.md "Tiers"): tier 1 makes the desktop icons hop on each beat, tier 2
// turns the wallpaper into a Windows Media Player visualization, tier 3 sets off the Solitaire win cascade.
// It all lies over the wallpaper and under the icons and windows, so nothing covers a target. Drawn from beats and
// audio time; dropping below a tier stops its effect at once.

import { Container } from 'pixi.js';
import type { ComboTier } from '@/rhythm/combo.ts';
import { clamp01 } from '@/ui/easing.ts';
import type { XpDesktop } from './components/desktop.ts';
import { MediaVisualizer } from './media-visualizer.ts';
import { SolitaireCascade } from './solitaire-cascade.ts';

/** Highest icon hop (px), at the half beat; they land on the beat */
const HOP_HEIGHT = 6;
/** The visualization fades in over this many beats */
const FADE_BEATS = 1;

export class XpComboEffects {
  readonly layer = new Container({ label: 'combo-effects' });
  private readonly desktop: XpDesktop;
  private readonly visualizer = new MediaVisualizer();
  private readonly cascade = new SolitaireCascade();
  /** Beat each tier was reached, by tier (index 0 unused); null while below it */
  private readonly reachedAt: (number | null)[] = [null, null, null, null];

  constructor(desktop: XpDesktop) {
    this.desktop = desktop;
    this.layer.addChild(this.visualizer.view, this.cascade.view);
    this.layer.visible = false;
    desktop.addBackdrop(this.layer);
  }

  update(tier: ComboTier, beat: number, audioTime: number): void {
    for (let t = 1; t <= 3; t++) {
      if (tier < t) this.reachedAt[t] = null;
      else this.reachedAt[t] ??= beat;
    }
    const phase = beat - Math.floor(beat);

    this.desktop.setIconLift(tier >= 1 ? HOP_HEIGHT * Math.sin(Math.PI * phase) : 0);

    const visualizerStart = this.reachedAt[2] ?? null;
    this.layer.visible = visualizerStart !== null;
    if (visualizerStart === null) return;
    this.visualizer.update(beat, audioTime, clamp01((beat - visualizerStart) / FADE_BEATS));

    const cascadeStart = this.reachedAt[3] ?? null;
    if (cascadeStart === null) {
      this.cascade.clear();
      return;
    }
    // The first card leaves on the next whole beat, so every landing falls on a beat
    this.cascade.update(Math.ceil(cascadeStart), beat);
  }

  /** Puts the icons back and hides everything (leaving a round) */
  clear(): void {
    this.reachedAt.fill(null);
    this.desktop.setIconLift(0);
    this.cascade.clear();
    this.layer.visible = false;
  }

  destroy(): void {
    this.clear();
    this.cascade.destroy();
    this.layer.destroy({ children: true });
  }
}
