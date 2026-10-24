// The Mac combo effects' motion (doc/combo.md "Mac details"): it follows the beat and repeats exactly.

import { describe, expect, it } from 'vite-plus/test';
import { BUBBLES_PER_ROW, bubblesAt, POP_BEATS, RISE_BEATS } from './aqua-bubbles.ts';
import { ribbonPoint } from './flurry.ts';

const AREA = { width: 1024, top: 30, bottom: 480 };

describe('Aqua bubbles', () => {
  it('starts a row on each whole beat from the tier, none before', () => {
    expect(bubblesAt(4.5, 4.9, AREA)).toEqual([]);
    expect(bubblesAt(4.5, 5, AREA)).toHaveLength(BUBBLES_PER_ROW);
    expect(bubblesAt(4.5, 6.5, AREA)).toHaveLength(BUBBLES_PER_ROW * 2);
  });

  it('rises from the bottom to the top in RISE_BEATS, then pops on that beat and is gone a pop later', () => {
    const startRow = bubblesAt(0, 0, AREA);
    for (const bubble of startRow) expect(bubble.y + bubble.radius).toBeCloseTo(AREA.bottom);
    const arrived = bubblesAt(0, RISE_BEATS, AREA).slice(0, BUBBLES_PER_ROW);
    for (const bubble of arrived) {
      expect(bubble.y - bubble.radius).toBeCloseTo(AREA.top);
      expect(bubble.pop).toBe(0);
    }
    const later = bubblesAt(0, RISE_BEATS + POP_BEATS + 0.01, AREA);
    // Only the rows started on beats 1 to 4 are left
    expect(later).toHaveLength(BUBBLES_PER_ROW * RISE_BEATS);
  });

  it('keeps every bubble inside the area, and draws the same beat the same way', () => {
    for (let beat = 0; beat < 12; beat += 0.25) {
      for (const bubble of bubblesAt(0, beat, AREA)) {
        expect(bubble.y - bubble.radius).toBeGreaterThanOrEqual(AREA.top - 1e-9);
        expect(bubble.y + bubble.radius).toBeLessThanOrEqual(AREA.bottom + 1e-9);
      }
    }
    expect(bubblesAt(0, 7.3, AREA)).toEqual(bubblesAt(0, 7.3, AREA));
  });
});

describe('Flurry', () => {
  const centre = { x: 512, y: 288 };

  it('ribbons start at the source near the middle and stream away from it', () => {
    for (let ribbon = 0; ribbon < 4; ribbon++) {
      const head = ribbonPoint(centre, ribbon, 20, 0);
      expect(Math.abs(head.x - centre.x)).toBeLessThanOrEqual(70);
      expect(Math.abs(head.y - centre.y)).toBeLessThanOrEqual(45);
      const tail = ribbonPoint(centre, ribbon, 20, 0.5);
      expect(Math.hypot(tail.x - head.x, tail.y - head.y)).toBeGreaterThan(30);
    }
  });
});
