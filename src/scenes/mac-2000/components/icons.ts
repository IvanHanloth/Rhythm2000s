// 本地素材里没有的图标，按原版样子用矢量画：菜单栏的蓝色苹果、Finder 笑脸、废纸篓、警告三角、
// 箭头指针、文稿和文件夹。
// 每个函数返回左上角在 (0, 0) 的图形，内部按固定的单位坐标绘制，再整体缩放到需要的大小。

import { Graphics } from 'pixi.js';
import { AQUA } from '@/theme/aqua.ts';
import { hGradient, vGradient } from './paint.ts';

/**
 * 菜单栏的苹果标志：蓝色半透明果冻质感。单位坐标 20×24。
 * white：苹果菜单打开时，标题底变成蓝色，苹果画成白色（按记忆，没有对照原机核对）。
 */
export function drawAppleLogo(height: number, { white = false } = {}): Graphics {
  const { top, bottom } = AQUA.apple;
  const rim = white ? AQUA.white : AQUA.apple.rim;
  const fill = white
    ? AQUA.white
    : vGradient([
        [0, top],
        [1, bottom],
      ]);
  const g = new Graphics({ label: 'apple-logo' })
    // 叶子
    .moveTo(10.3, 5.6)
    .bezierCurveTo(10.1, 3.2, 11.8, 1.0, 14.6, 0.6)
    .bezierCurveTo(14.8, 3.1, 13.0, 5.4, 10.3, 5.6)
    .closePath()
    .fill(fill)
    .stroke({ width: 0.8, color: rim })
    // 果身：右侧咬掉一口，底部中间凹进去
    .moveTo(10, 7.2)
    .bezierCurveTo(11.6, 6.2, 13.6, 5.9, 15.4, 6.6)
    .bezierCurveTo(16.8, 7.2, 17.8, 8.2, 18.4, 9.2)
    .bezierCurveTo(16.4, 10.4, 15.6, 12.2, 15.9, 14.0)
    .bezierCurveTo(16.2, 15.8, 17.3, 16.9, 18.8, 17.4)
    .bezierCurveTo(18.2, 19.4, 17.0, 21.4, 15.6, 22.8)
    .bezierCurveTo(14.6, 23.8, 13.4, 23.8, 12.2, 23.3)
    .bezierCurveTo(11.0, 22.8, 9.2, 22.8, 8.0, 23.3)
    .bezierCurveTo(6.8, 23.8, 5.6, 23.8, 4.6, 22.8)
    .bezierCurveTo(2.6, 20.8, 0.6, 17.0, 0.6, 13.4)
    .bezierCurveTo(0.6, 9.0, 3.2, 6.4, 6.2, 6.4)
    .bezierCurveTo(7.6, 6.4, 8.8, 7.0, 10, 7.2)
    .closePath()
    .fill(fill)
    .stroke({ width: 0.8, color: rim })
    // 上半部的高光
    .ellipse(8.2, 10.6, 5.2, 3.0)
    .fill(
      vGradient([
        [0, 'rgba(255,255,255,0.75)'],
        [1, 'rgba(255,255,255,0.05)'],
      ]),
    );
  g.scale.set(height / 24);
  return g;
}

/** Finder 笑脸：左半边浅蓝的正脸、右半边深蓝的侧脸。单位坐标 48×48。 */
export function drawFinderIcon(size: number): Graphics {
  const c = AQUA.finder;
  const profile = (g: Graphics) =>
    g
      .lineTo(25.5, 4.5)
      .bezierCurveTo(24.5, 10, 24, 15, 22, 19.5)
      .bezierCurveTo(20.5, 22, 19, 23.5, 18.5, 25.5)
      .lineTo(22.5, 26.5)
      .bezierCurveTo(23, 29, 23.2, 33, 24, 37)
      .bezierCurveTo(24.4, 40, 24.8, 42, 25, 43.5);

  const g = new Graphics({ label: 'finder-icon' })
    .roundRect(4, 4, 40, 40, 5)
    .fill(
      vGradient([
        [0, c.dark],
        [1, c.darkEdge],
      ]),
    )
    .stroke({ width: 1, color: c.darkEdge });

  g.moveTo(9, 4.5);
  profile(g)
    .lineTo(9, 43.5)
    .quadraticCurveTo(4.5, 43.5, 4.5, 39)
    .lineTo(4.5, 9)
    .quadraticCurveTo(4.5, 4.5, 9, 4.5)
    .closePath()
    .fill(
      vGradient([
        [0, c.light],
        [1, c.lightEdge],
      ]),
    );

  g.moveTo(25.5, 4.5);
  profile(g).stroke({ width: 1.4, color: c.face, join: 'round' });

  g.roundRect(13, 13, 3, 9, 1.5)
    .fill(c.face)
    .roundRect(32, 13, 3, 9, 1.5)
    .fill(c.face)
    .moveTo(11, 32)
    .quadraticCurveTo(24, 40, 38, 31)
    .stroke({ width: 2, color: c.face, cap: 'round' })
    // 玻璃质感的高光
    .roundRect(6, 5.5, 36, 15, 6)
    .fill(
      vGradient([
        [0, 'rgba(255,255,255,0.5)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    );
  g.scale.set(size / 48);
  return g;
}

/** 废纸篓：10.0–10.2 的金属网篓；full 时网篓里露出揉皱的白纸。单位坐标 48×48。 */
export function drawTrashIcon(size: number, { full = false } = {}): Graphics {
  const c = AQUA.trash;
  const top = 12;
  const bottom = 44;
  const g = new Graphics({ label: full ? 'trash-icon-full' : 'trash-icon' });
  if (full) {
    // 揉皱的纸团从篓口冒出来，画在网篓后面
    for (const [x, y, r] of [
      [17, 11, 7],
      [27, 9, 8],
      [33, 13, 6],
      [22, 15, 7],
    ] as const) {
      g.circle(x, y, r).fill(c.paper).stroke({ width: 0.8, color: c.paperShade });
    }
    g.moveTo(14, 10)
      .lineTo(19, 13)
      .moveTo(24, 6)
      .lineTo(29, 11)
      .moveTo(31, 12)
      .lineTo(36, 10)
      .stroke({ width: 0.8, color: c.paperShade });
  }
  g.moveTo(9, top)
    .lineTo(13, bottom)
    .quadraticCurveTo(24, bottom + 3, 35, bottom)
    .lineTo(39, top)
    .closePath()
    .fill({
      fill: hGradient([
        [0, c.dark],
        [0.45, c.light],
        [1, c.dark],
      ]),
      alpha: 0.85,
    });

  // 竖向的网丝
  const ribs = 9;
  for (let i = 0; i < ribs; i++) {
    const t = i / (ribs - 1);
    g.moveTo(9 + t * 30, top).lineTo(13 + t * 22, bottom + 1);
  }
  g.stroke({ width: 0.8, color: c.wire, alpha: 0.7 });

  // 横向的网丝
  for (const y of [20, 28, 36]) {
    const t = (y - top) / (bottom - top);
    g.moveTo(9 + 4 * t, y).lineTo(39 - 4 * t, y);
  }
  g.stroke({ width: 0.8, color: c.wire, alpha: 0.5 });

  // 篓口
  g.ellipse(24, top, 15.5, 4)
    .fill({ color: c.inside, alpha: 0.6 })
    .stroke({ width: 1.6, color: c.wire })
    .ellipse(24, top - 0.6, 15.5, 4)
    .stroke({ width: 0.8, color: c.light, alpha: 0.8 });

  g.scale.set(size / 48);
  return g;
}

/** 警告提示框的黄色三角（kAlertCautionIcon），带黑色感叹号。单位坐标 64×64。 */
export function drawCautionIcon(size: number): Graphics {
  const c = AQUA.caution;
  const triangle = [32, 5, 60, 55, 4, 55];
  const g = new Graphics({ label: 'caution-icon' })
    .poly(triangle)
    .fill(
      vGradient([
        [0, c.top],
        [1, c.bottom],
      ]),
    )
    .stroke({ width: 3, color: c.rim, join: 'round' })
    // 上半部的玻璃高光
    .poly([32, 9, 46, 34, 18, 34])
    .fill(
      vGradient([
        [0, 'rgba(255,255,255,0.7)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    )
    .roundRect(29, 19, 6, 23, 3)
    .fill(c.mark)
    .circle(32, 48, 3.4)
    .fill(c.mark);
  g.scale.set(size / 64);
  return g;
}

/**
 * 箭头指针（NSCursor arrowCursor）：黑色箭头、白色描边，下面一层淡淡的投影。
 * 热点（箭头尖）在 (0, 0)，原版像素尺寸。
 */
export function drawArrowCursor(): Graphics {
  const arrow = [0, 0, 0, 16, 4, 12.3, 7, 18.6, 9.6, 17.5, 6.7, 11.3, 11.6, 11.3];
  return new Graphics({ label: 'arrow-cursor' })
    .poly(arrow.map((v, i) => v + (i % 2 === 0 ? 1 : 1.6)))
    .fill({ color: AQUA.shadow, alpha: 0.28 })
    .poly(arrow)
    .fill(AQUA.cursor.fill)
    .stroke({ width: 1.4, color: AQUA.cursor.outline, join: 'round' });
}

/** 文稿图标：右上角折角的白纸。单位坐标 48×48；叠在中间的程序小图标由调用方放。 */
export function drawDocumentIcon(size: number): Graphics {
  const c = AQUA.document;
  const left = 8;
  const right = 40;
  const top = 2;
  const bottom = 46;
  const fold = 11;
  const g = new Graphics({ label: 'document-icon' })
    .poly([
      left + 1,
      top + 1.5,
      right - fold + 1,
      top + 1.5,
      right + 1,
      top + fold + 1.5,
      right + 1,
      bottom + 1.5,
      left + 1,
      bottom + 1.5,
    ])
    .fill({ color: AQUA.shadow, alpha: 0.25 })
    .poly([left, top, right - fold, top, right, top + fold, right, bottom, left, bottom])
    .fill(c.paper)
    .stroke({ width: 1, color: c.edge, join: 'round' })
    .poly([right - fold, top, right - fold, top + fold, right, top + fold])
    .fill(c.fold)
    .stroke({ width: 1, color: c.edge, join: 'round' });
  g.scale.set(size / 48);
  return g;
}

/** 文件夹：10.0–10.2 的蓝色文件夹，左上角一个标签。单位坐标 48×48。 */
export function drawFolderIcon(size: number): Graphics {
  const c = AQUA.folder;
  const g = new Graphics({ label: 'folder-icon' })
    .roundRect(4, 8, 18, 8, 3)
    .fill(c.tab)
    .stroke({ width: 1, color: c.edge })
    .roundRect(3, 12, 42, 32, 3)
    .fill({ color: AQUA.shadow, alpha: 0.2 })
    .roundRect(2, 11, 42, 32, 3)
    .fill(
      vGradient([
        [0, c.top],
        [1, c.bottom],
      ]),
    )
    .stroke({ width: 1, color: c.edge })
    .roundRect(4, 13, 38, 10, 2)
    .fill(
      vGradient([
        [0, 'rgba(255,255,255,0.6)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    );
  g.scale.set(size / 48);
  return g;
}
