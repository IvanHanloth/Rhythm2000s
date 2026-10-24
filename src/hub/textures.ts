// Textures painted on a canvas: text on light-box signs and posters (English only in the world) and the puppet's face.
// Realistic wall and floor textures are photographs, see assets.ts.

import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { cssFontFamily, FONT_FAMILIES } from '@/theme/tokens.ts';
import { STREET_COLORS as C } from '@/theme/street.ts';

/** Lettering on signs and posters: a heavy sans-serif */
const SIGN_FONT = cssFontFamily(['Arial Black', 'Impact', ...FONT_FAMILIES.ui]);

type Draw = (g: CanvasRenderingContext2D, width: number, height: number) => void;

function paint(width: number, height: number, draw: Draw, smooth = false): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  draw(g, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (!smooth) {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
  }
  return texture;
}

function fitText(g: CanvasRenderingContext2D, text: string, maxWidth: number, size: number): void {
  let px = size;
  do {
    g.font = `900 ${px}px ${SIGN_FONT}`;
    px -= 2;
  } while (g.measureText(text).width > maxWidth && px > 8);
}

export interface SignOptions {
  text: string;
  sub?: string;
  background: string;
  color?: string;
  /** Border (neon tube) colour */
  border?: string;
  width?: number;
  height?: number;
}

/** Shop sign: one large line, optionally one small line */
export function signTexture(options: SignOptions): Texture {
  const { text, sub, background, color = C.signText, border, width = 512, height = 128 } = options;
  return paint(
    width,
    height,
    (g, w, h) => {
      g.fillStyle = background;
      g.fillRect(0, 0, w, h);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = h * 0.06;
        g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
      }
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitText(g, text, w * 0.86, sub ? h * 0.52 : h * 0.66);
      g.fillText(text, w / 2, sub ? h * 0.42 : h * 0.53);
      if (sub) {
        g.font = `700 ${Math.round(h * 0.18)}px ${SIGN_FONT}`;
        g.fillText(sub, w / 2, h * 0.8);
      }
    },
    true,
  );
}

/** A notice or poster on a wall: a few lines of text */
export function posterTexture(lines: string[], background: string, color: string): Texture {
  return paint(
    192,
    256,
    (g, w, h) => {
      g.fillStyle = background;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = color;
      g.lineWidth = 4;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const step = (h - 40) / lines.length;
      lines.forEach((line, i) => {
        fitText(g, line, w - 36, i === 0 ? 40 : 26);
        g.fillText(line, w / 2, 20 + step * (i + 0.5));
      });
    },
    true,
  );
}

/**
 * Scrolling LED matrix: amber text under a dot grid. The texture tiles horizontally and scrolls through offset.x;
 * the text is repeated so the ends meet while scrolling.
 */
export function ledTexture(text: string, color: string): Texture {
  const height = 48;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `900 34px ${SIGN_FONT}`;
  const width = Math.ceil(probe.measureText(text).width / 4) * 4 + 64;
  const texture = paint(width, height, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = `900 34px ${SIGN_FONT}`;
    g.textBaseline = 'middle';
    g.fillText(text, 32, h / 2 + 2);
    // Dot grid: a cell every 4 px, black between cells
    g.fillStyle = '#000000';
    for (let x = 0; x < w; x += 4) g.fillRect(x + 3, 0, 1, h);
    for (let y = 0; y < h; y += 4) g.fillRect(0, y + 3, w, 1);
  });
  texture.wrapS = RepeatWrapping;
  return texture;
}

/** Large anime eyes (decal, transparent, not nearest-neighbour). mirror makes the left eye, lashes flicking left */
export function eyeTexture(iris: string, irisDark: string, lash: string, mirror: boolean): Texture {
  return paint(
    96,
    128,
    (g, w) => {
      if (mirror) {
        g.translate(w, 0);
        g.scale(-1, 1);
      }
      // Iris: dark at the top, light at the bottom
      const gradient = g.createLinearGradient(0, 30, 0, 118);
      gradient.addColorStop(0, irisDark);
      gradient.addColorStop(0.55, iris);
      gradient.addColorStop(1, '#bfe0ff');
      g.fillStyle = gradient;
      g.beginPath();
      g.ellipse(48, 74, 34, 46, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = irisDark;
      g.beginPath();
      g.ellipse(48, 70, 16, 24, 0, 0, Math.PI * 2);
      g.fill();
      // Highlight
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(34, 52, 12, 14, -0.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(62, 98, 6, 6, 0, 0, Math.PI * 2);
      g.fill();
      // Upper lashes: a thick arc lifting at the outer corner
      g.strokeStyle = lash;
      g.lineCap = 'round';
      g.lineWidth = 11;
      g.beginPath();
      g.moveTo(8, 40);
      g.quadraticCurveTo(48, 12, 90, 30);
      g.stroke();
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(84, 28);
      g.lineTo(94, 16);
      g.stroke();
      // Lower lash line
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(26, 120);
      g.quadraticCurveTo(48, 126, 70, 120);
      g.stroke();
    },
    true,
  );
}

/** Small mouth */
export function mouthTexture(color: string): Texture {
  return paint(
    64,
    32,
    (g) => {
      g.strokeStyle = color;
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(18, 10);
      g.quadraticCurveTo(32, 26, 46, 10);
      g.stroke();
    },
    true,
  );
}

/** Blush: a pink ellipse with soft edges */
export function blushTexture(color: string): Texture {
  return paint(
    64,
    32,
    (g) => {
      const gradient = g.createRadialGradient(32, 16, 2, 32, 16, 30);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, `${color}00`);
      g.fillStyle = gradient;
      g.scale(1, 0.5);
      g.beginPath();
      g.arc(32, 32, 30, 0, Math.PI * 2);
      g.fill();
    },
    true,
  );
}
