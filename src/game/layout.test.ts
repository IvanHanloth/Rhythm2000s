import { describe, expect, it } from 'vite-plus/test';
import { fitToScreen } from './layout.ts';

describe('fitToScreen', () => {
  it('fills the screen with no letterbox when the aspect matches', () => {
    expect(fitToScreen(1920, 1080)).toEqual({ scale: 1.5, x: 0, y: 0 });
  });

  it('letterboxes left and right on a wider screen', () => {
    expect(fitToScreen(1600, 720)).toEqual({ scale: 1, x: 160, y: 0 });
  });

  it('letterboxes top and bottom on a taller screen', () => {
    expect(fitToScreen(640, 720)).toEqual({ scale: 0.5, x: 0, y: 180 });
  });

  it('scales to 0 for a 0-sized screen without producing NaN', () => {
    expect(fitToScreen(0, 0)).toEqual({ scale: 0, x: 0, y: 0 });
  });
});
