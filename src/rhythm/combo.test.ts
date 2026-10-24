import { describe, expect, it } from 'vite-plus/test';
import { ComboTracker, comboTier } from './combo.ts';

describe('comboTier', () => {
  it('starts each tier at 10, 25 and 50', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 200].map(comboTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('ComboTracker', () => {
  it('Perfect and Good add one, a Miss resets and reports what was lost', () => {
    const combo = new ComboTracker();
    combo.record('perfect', 1);
    combo.record('good', 2);
    expect(combo.count).toBe(2);
    expect(combo.lastHit).toBe(2);

    expect(combo.record('miss', 3)).toEqual({ time: 3, lost: 2 });
    expect(combo.count).toBe(0);
    expect(combo.lastBreak).toEqual({ time: 3, lost: 2 });
  });

  it('a Miss with no combo running is not a break', () => {
    const combo = new ComboTracker();
    expect(combo.record('miss', 1)).toBeNull();
    expect(combo.lastBreak).toBeNull();
  });

  it('keeps the longest combo across resets', () => {
    const combo = new ComboTracker();
    for (let i = 0; i < 12; i++) combo.record('perfect', i);
    expect(combo.tier).toBe(1);
    combo.record('miss', 12);
    combo.record('good', 13);
    expect(combo.best).toBe(12);
    expect(combo.tier).toBe(0);
  });
});
