// Hub collisions: the character is a circle on the ground; walls, counters and tables are rectangles in the x–z plane.
// No three.js, so unit tests can use it.

/** Axis-aligned rectangle in the horizontal plane */
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

/** Rectangle centred at (x, z), `width` along x and `depth` along z */
export function boxAt(x: number, z: number, width: number, depth: number): Box {
  return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
}

/**
 * Pushes a circle of `radius` out of every rectangle and returns the new centre. A centre inside a rectangle leaves
 * through the nearest edge. Adjacent rectangles take a few passes so the circle can't wedge into a gap.
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
