// Combo effects on the XP desktop (doc/combo.md "Tiers"): tier 1 makes the desktop icons hop on each beat, tier 2
// brightens the Bliss sky with drifting clouds, tier 3 grows 3D Pipes along the screen edges, one segment per beat.
// It all lies over the wallpaper and under the icons and windows, so nothing covers a target. Drawn from beats and
// audio time; dropping below a tier stops its effect at once.

import { AlphaFilter, BlurFilter, Container, Graphics } from 'pixi.js';
import type { ComboTier } from '@/rhythm/combo.ts';
import { LUNA } from '@/theme/xp-luna.ts';
import { clamp01, easeOutBack } from '@/ui/easing.ts';
import type { XpDesktop } from './components/desktop.ts';
import { WORK_AREA_HEIGHT, XP_SCREEN_WIDTH } from './components/screen.ts';

/** Highest icon hop (px), at the half beat; they land on the beat */
const HOP_HEIGHT = 6;
/** The sky light fades in over this many beats */
const FADE_BEATS = 1;
/** Height of the brightened sky and its strongest alpha */
const SKY_HEIGHT = 240;
const SKY_ALPHA = 0.32;
const SKY_STRIPS = 12;
/** Clouds are drawn opaque, then blurred and made see-through as one layer so overlaps don't show */
const CLOUD_ALPHA = 0.55;
const CLOUD_BLUR = 6;
/** Cloud drift (px per second) */
const CLOUD_SPEED = 14;
const CLOUDS = [
  { x: 180, y: 70, size: 1 },
  { x: 520, y: 40, size: 0.8 },
  { x: 820, y: 95, size: 1.2 },
  { x: 1100, y: 55, size: 0.9 },
];
const CLOUD_SPAN = XP_SCREEN_WIDTH + 260;
/** Pipe length added per beat (px), thickness and joint radius */
const SEGMENT = 34;
const PIPE_WIDTH = 10;
const JOINT_RADIUS = 7;
/** Each pipe's route around the screen edge (virtual screen), clear of the left icon column and the Recycle Bin */
const PIPE_ROUTES: { x: number; y: number }[][] = [
  [
    { x: 96, y: 14 },
    { x: 1008, y: 14 },
    { x: 1008, y: 380 },
  ],
  [
    { x: 96, y: WORK_AREA_HEIGHT - 14 },
    { x: 920, y: WORK_AREA_HEIGHT - 14 },
    { x: 920, y: WORK_AREA_HEIGHT - 120 },
  ],
  [
    { x: 112, y: 44 },
    { x: 112, y: WORK_AREA_HEIGHT - 44 },
  ],
];

export class XpComboEffects {
  readonly layer = new Container({ label: 'combo-effects' });
  private readonly desktop: XpDesktop;
  private readonly sky = new Graphics();
  private readonly clouds = new Container({ label: 'clouds' });
  private readonly pipes = new Graphics();
  private readonly cloudAlpha = new AlphaFilter({ alpha: CLOUD_ALPHA });
  /** Beat each tier was reached, by tier (index 0 unused); null while below it */
  private readonly reachedAt: (number | null)[] = [null, null, null, null];

  constructor(desktop: XpDesktop) {
    this.desktop = desktop;
    const c = LUNA.combo;
    for (let i = 0; i < SKY_STRIPS; i++) {
      const h = SKY_HEIGHT / SKY_STRIPS;
      this.sky
        .rect(0, i * h, XP_SCREEN_WIDTH, h)
        .fill({ color: c.skyLight, alpha: 1 - i / SKY_STRIPS });
    }
    for (const cloud of CLOUDS) {
      const g = drawCloud(c.cloud);
      g.scale.set(cloud.size);
      g.position.set(cloud.x, cloud.y);
      this.clouds.addChild(g);
    }
    this.clouds.filters = [new BlurFilter({ strength: CLOUD_BLUR }), this.cloudAlpha];
    this.layer.addChild(this.sky, this.clouds, this.pipes);
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

    const skyStart = this.reachedAt[2] ?? null;
    this.layer.visible = skyStart !== null;
    if (skyStart === null) return;
    const fade = clamp01((beat - skyStart) / FADE_BEATS);
    // A little brighter right on the beat
    this.sky.alpha = SKY_ALPHA * fade * (0.85 + 0.15 * (1 - phase));
    this.cloudAlpha.alpha = CLOUD_ALPHA * fade;
    this.clouds.children.forEach((cloud, i) => {
      const x = CLOUDS[i]!.x + audioTime * CLOUD_SPEED;
      cloud.x = ((((x + 130) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN) - 130;
    });

    this.pipes.clear();
    const pipeStart = this.reachedAt[3] ?? null;
    if (pipeStart === null) return;
    const beats = beat - pipeStart;
    // Each beat a new segment shoots out, overshooting a touch like the screen saver's joints popping in
    const grown = (Math.floor(beats) + Math.min(1, easeOutBack(clamp01(phase * 2)))) * SEGMENT;
    PIPE_ROUTES.forEach((route, i) => drawPipe(this.pipes, route, grown, LUNA.combo.pipes[i]!));
  }

  /** Puts the icons back and hides everything (leaving a round) */
  clear(): void {
    this.reachedAt.fill(null);
    this.desktop.setIconLift(0);
    this.pipes.clear();
    this.layer.visible = false;
  }

  destroy(): void {
    this.clear();
    this.layer.destroy({ children: true });
  }
}

/** A cloud's shape: overlapping opaque circles, centred on the origin (the layer's filters soften it) */
function drawCloud(color: string): Graphics {
  const g = new Graphics();
  for (const [x, y, r] of [
    [-42, 6, 20],
    [-16, -8, 28],
    [16, -4, 26],
    [44, 8, 18],
    [0, 12, 22],
  ] as const) {
    g.circle(x, y, r).fill(color);
  }
  return g;
}

/** Draws the first `length` px of `route` as a shaded pipe with ball joints at each corner and segment end */
function drawPipe(
  g: Graphics,
  route: readonly { x: number; y: number }[],
  length: number,
  colors: { base: string; light: string; dark: string },
): void {
  const points: { x: number; y: number }[] = [route[0]!];
  const joints: { x: number; y: number }[] = [route[0]!];
  let left = length;
  let walked = 0;
  for (let i = 1; i < route.length && left > 0; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const take = Math.min(span, left);
    const end = { x: a.x + ((b.x - a.x) * take) / span, y: a.y + ((b.y - a.y) * take) / span };
    // Joints where each beat's segment ended along this stretch
    for (let d = Math.ceil(walked / SEGMENT) * SEGMENT - walked; d < take; d += SEGMENT) {
      if (d > 0)
        joints.push({ x: a.x + ((b.x - a.x) * d) / span, y: a.y + ((b.y - a.y) * d) / span });
    }
    points.push(end);
    if (take === span) joints.push(b);
    walked += take;
    left -= take;
  }
  if (points.length < 2) return;

  const line = (width: number, color: string, dx = 0, dy = 0) => {
    g.moveTo(points[0]!.x + dx, points[0]!.y + dy);
    for (const p of points.slice(1)) g.lineTo(p.x + dx, p.y + dy);
    g.stroke({ width, color, cap: 'round', join: 'round' });
  };
  line(PIPE_WIDTH + 2, colors.dark);
  line(PIPE_WIDTH - 2, colors.base);
  line(2, colors.light, -1.5, -1.5);
  for (const joint of [...joints, points.at(-1)!]) {
    g.circle(joint.x, joint.y, JOINT_RADIUS)
      .fill(colors.base)
      .stroke({ width: 1, color: colors.dark })
      .circle(joint.x - 2, joint.y - 2, 2.5)
      .fill(colors.light);
  }
}
