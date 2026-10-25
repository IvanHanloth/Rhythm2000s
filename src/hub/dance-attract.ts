// The attract loop on the street's dance machine screen (doc/dance-machine.md "The cabinet in the street"): the title,
// the ring of eight targets with arrows flying out to them in turn, and a blinking "PRESS E TO PLAY".
// Painted on a canvas and redrawn a few times a second from the street's clock; nothing here is judged.

import { CanvasTexture, SRGBColorSpace } from 'three';
import { traceArrow } from '@/dance/arrow-shape.ts';
import {
  DIRECTION_KEYS,
  DIRECTIONS,
  directionAngle,
  type Arrow,
  type Direction,
} from '@/dance/steps.ts';
import { DANCE_COLORS as C } from '@/theme/dance-machine.ts';
import { cssFontFamily, FONT_FAMILIES } from '@/theme/tokens.ts';

const WIDTH = 512;
const HEIGHT = 384;
/** Tempo of the demo (beats per second, 120 BPM) */
const BEATS_PER_SECOND = 2;
/** Redraws per second: smooth enough for a screen seen across the arcade */
const FRAMES_PER_SECOND = 20;
/** The demo's steps, one per beat: round the ring, then the diagonals */
const DEMO: readonly Direction[] = [
  ...DIRECTIONS,
  'up-left',
  'down-right',
  'up-right',
  'down-left',
  'left',
  'right',
  'up',
  'down',
];
/** Beats an arrow takes from the centre to its target, as in the game */
const APPROACH_BEATS = 2;
const CENTER = { x: WIDTH / 2, y: 214 };
const RING = 112;
const START = 26;
const FONT = cssFontFamily(FONT_FAMILIES.display);

export class DanceAttractScreen {
  readonly texture: CanvasTexture;
  private readonly g: CanvasRenderingContext2D;
  private frame = -1;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('No 2D canvas for the dance machine screen');
    this.g = g;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.draw(0);
  }

  /** The pad keys the demo is stepping on at street time `t` (s), for the pad's panels to light up */
  litKeys(t: number): readonly Arrow[] {
    const beat = t * BEATS_PER_SECOND;
    if (beat - Math.floor(beat) > 0.35) return [];
    return DIRECTION_KEYS[DEMO[Math.floor(beat) % DEMO.length]!];
  }

  /** Call every frame with the street time (s); redraws at FRAMES_PER_SECOND */
  update(t: number): void {
    const frame = Math.floor(t * FRAMES_PER_SECOND);
    if (frame === this.frame) return;
    this.frame = frame;
    this.draw(t);
    this.texture.needsUpdate = true;
  }

  private draw(t: number): void {
    const { g } = this;
    const beat = t * BEATS_PER_SECOND;
    const pulse = (1 - (beat - Math.floor(beat))) ** 3;

    const back = g.createLinearGradient(0, 0, 0, HEIGHT);
    back.addColorStop(0, C.backTop);
    back.addColorStop(1, C.backBottom);
    g.fillStyle = back;
    g.fillRect(0, 0, WIDTH, HEIGHT);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 46px ${FONT}`;
    g.lineWidth = 3;
    g.strokeStyle = C.titleEdge;
    g.strokeText('DANCE MACHINE', WIDTH / 2, 44);
    g.fillStyle = C.title;
    g.fillText('DANCE MACHINE', WIDTH / 2, 44);

    // The ring, brighter on each beat
    g.globalAlpha = 0.3 + 0.4 * pulse;
    g.strokeStyle = C.guide;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(CENTER.x, CENTER.y, RING, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;

    for (const direction of DIRECTIONS) {
      this.arrow(direction, RING, 1, C.targetEdge, C.target);
    }
    // Arrows on their way: step i arrives on beat i
    for (let i = Math.floor(beat); i <= Math.floor(beat) + APPROACH_BEATS; i++) {
      const left = i - beat;
      if (left < 0 || left > APPROACH_BEATS) continue;
      const radius = RING - (left / APPROACH_BEATS) * (RING - START);
      const color = i % 2 === 0 ? C.quarter : C.eighth;
      this.arrow(
        DEMO[i % DEMO.length]!,
        radius,
        0.4 + 0.6 * (1 - left / APPROACH_BEATS),
        color,
        C.arrowEdge,
      );
    }

    if (Math.floor(t * 1.5) % 2 === 0) {
      g.font = `800 30px ${FONT}`;
      g.fillStyle = C.text;
      g.fillText('PRESS E TO PLAY', WIDTH / 2, HEIGHT - 30);
    }
  }

  /** A block arrow `radius` out from the centre along `direction`, pointing outward */
  private arrow(
    direction: Direction,
    radius: number,
    scale: number,
    fill: string,
    edge: string,
  ): void {
    const { g } = this;
    const angle = directionAngle(direction);
    g.save();
    g.translate(CENTER.x + Math.cos(angle) * radius, CENTER.y + Math.sin(angle) * radius);
    g.rotate(angle + Math.PI / 2);
    g.scale(scale * 0.42, scale * 0.42);
    traceArrow(g);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = edge;
    g.stroke();
    g.restore();
  }
}

/** A white arrow on black for a pad panel's glowing decal (emissive map); the panel's colour comes from its material */
export function padArrowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No 2D canvas for the dance pad');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2);
  g.scale(1.05, 1.05);
  traceArrow(g);
  g.fillStyle = '#ffffff';
  g.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
