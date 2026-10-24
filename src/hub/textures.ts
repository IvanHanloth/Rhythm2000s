// 用 Canvas 现画的贴图：灯箱招牌和海报上的文字（场景里只用英文），以及备用人偶的脸。
// 墙面、地面等写实贴图是照片素材，见 assets.ts。

import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { FONT_FAMILIES } from '../theme/tokens.ts';
import { STREET_COLORS as C } from '../theme/street.ts';

/** 招牌、海报上的字（场景里只用英文）：粗黑的无衬线体 */
const SIGN_FONT = `"Arial Black", Impact, ${FONT_FAMILIES.ui.join(', ')}`;

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
  /** 边框（霓虹灯管）的颜色 */
  border?: string;
  width?: number;
  height?: number;
}

/** 店铺招牌：一行大字，可带一行小字 */
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

/** 贴在墙上的告示、海报：几行字 */
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
 * LED 点阵滚动屏：琥珀色字，盖一层点阵网格。贴图横向平铺，滚动靠改 offset.x。
 * text 会重复两遍，保证滚动时首尾接得上。
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
    // 点阵：每 4 像素一格，格子之间涂黑
    g.fillStyle = '#000000';
    for (let x = 0; x < w; x += 4) g.fillRect(x + 3, 0, 1, h);
    for (let y = 0; y < h; y += 4) g.fillRect(0, y + 3, w, 1);
  });
  texture.wrapS = RepeatWrapping;
  return texture;
}

/** 动漫风的大眼睛（贴花，透明底，不做最近邻采样）。mirror 为 true 时是左眼，睫毛尾巴朝左 */
export function eyeTexture(iris: string, irisDark: string, lash: string, mirror: boolean): Texture {
  return paint(
    96,
    128,
    (g, w) => {
      if (mirror) {
        g.translate(w, 0);
        g.scale(-1, 1);
      }
      // 虹膜：上深下浅
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
      // 高光
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(34, 52, 12, 14, -0.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(62, 98, 6, 6, 0, 0, Math.PI * 2);
      g.fill();
      // 上睫毛：粗弧线，外眼角上挑
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
      // 下眼线
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(26, 120);
      g.quadraticCurveTo(48, 126, 70, 120);
      g.stroke();
    },
    true,
  );
}

/** 小嘴 */
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

/** 腮红：边缘渐隐的粉色椭圆 */
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
