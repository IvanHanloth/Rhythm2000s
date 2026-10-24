import { describe, expect, it } from 'vite-plus/test';
import { cutawayPhase } from './cutaway.ts';

describe('cutawayPhase', () => {
  it('starts and ends in front of the monitor with the chair facing it', () => {
    expect(cutawayPhase(0)).toEqual({ path: 0, spin: 0 });
    const end = cutawayPhase(1);
    expect(end.path).toBe(0);
    expect(end.spin).toBeCloseTo(2 * Math.PI);
  });

  it('pulls back, spins one full turn while the camera holds, then pushes back in', () => {
    expect(cutawayPhase(0.125).path).toBeCloseTo(1);
    expect(cutawayPhase(0.25)).toEqual({ path: 2, spin: 0 });
    expect(cutawayPhase(0.5).path).toBe(2);
    expect(cutawayPhase(0.5).spin).toBeCloseTo(Math.PI);
    expect(cutawayPhase(0.875).path).toBeCloseTo(1);
  });

  it('never turns backwards', () => {
    let last = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const { spin } = cutawayPhase(p);
      expect(spin).toBeGreaterThanOrEqual(last);
      last = spin;
    }
  });
});
