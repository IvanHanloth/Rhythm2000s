import { describe, expect, it } from 'vite-plus/test';
import { fitToScreen } from './layout.ts';

describe('fitToScreen', () => {
  it('屏幕比例相同时铺满，没有黑边', () => {
    expect(fitToScreen(1920, 1080)).toEqual({ scale: 1.5, x: 0, y: 0 });
  });

  it('屏幕更宽时左右留黑边', () => {
    expect(fitToScreen(1600, 720)).toEqual({ scale: 1, x: 160, y: 0 });
  });

  it('屏幕更高时上下留黑边', () => {
    expect(fitToScreen(640, 720)).toEqual({ scale: 0.5, x: 0, y: 180 });
  });

  it('屏幕尺寸为 0 时缩放为 0，不产生 NaN', () => {
    expect(fitToScreen(0, 0)).toEqual({ scale: 0, x: 0, y: 0 });
  });
});
