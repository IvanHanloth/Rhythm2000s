// 大厅里的碰撞：角色在地面上是一个圆，墙、柜台、桌子是水平面上的矩形（只看 x、z）。
// 不依赖 three，单元测试可以直接用。

/** 水平面上与坐标轴对齐的矩形 */
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Point {
  x: number;
  z: number;
}

/** 以 (x, z) 为中心、宽 width（x 方向）、深 depth（z 方向）的矩形 */
export function boxAt(x: number, z: number, width: number, depth: number): Box {
  return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
}

/**
 * 把半径为 radius 的圆从所有矩形里推出去，返回推出后的圆心。
 * 圆心落进矩形内部时，从离得最近的那条边推出。多个矩形相邻时重复几轮，避免卡进夹缝。
 */
export function pushOut(point: Point, radius: number, boxes: readonly Box[]): Point {
  let { x, z } = point;
  for (let round = 0; round < 3; round++) {
    let moved = false;
    for (const box of boxes) {
      const nearestX = Math.max(box.minX, Math.min(x, box.maxX));
      const nearestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      if (distSq > 1e-12) {
        const dist = Math.sqrt(distSq);
        x = nearestX + (dx / dist) * radius;
        z = nearestZ + (dz / dist) * radius;
      } else {
        const exits = [
          { d: x - box.minX, x: box.minX - radius, z },
          { d: box.maxX - x, x: box.maxX + radius, z },
          { d: z - box.minZ, x, z: box.minZ - radius },
          { d: box.maxZ - z, x, z: box.maxZ + radius },
        ];
        const exit = exits.reduce((a, b) => (b.d < a.d ? b : a));
        x = exit.x;
        z = exit.z;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}
