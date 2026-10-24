import { describe, expect, it } from 'vite-plus/test';
import { DOUBLE_CLICK_MS, DoubleClick } from './double-click.ts';

describe('DoubleClick', () => {
  it('two clicks on the same thing within the interval are a double-click, then the count resets', () => {
    const clicks = new DoubleClick();
    expect(clicks.click('a', 0)).toBe(false);
    expect(clicks.click('a', DOUBLE_CLICK_MS)).toBe(true);
    expect(clicks.click('a', DOUBLE_CLICK_MS + 10)).toBe(false);
  });

  it('different targets or too long an interval do not count', () => {
    const clicks = new DoubleClick();
    clicks.click('a', 0);
    expect(clicks.click('b', 100)).toBe(false);
    expect(clicks.click('b', 100 + DOUBLE_CLICK_MS + 1)).toBe(false);
  });
});
