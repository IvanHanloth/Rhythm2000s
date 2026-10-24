import { describe, expect, it } from 'vite-plus/test';
import { DOUBLE_CLICK_MS, DoubleClick } from './double-click.ts';

describe('DoubleClick', () => {
  it('同一个东西在间隔内点两下算双击，之后重新计数', () => {
    const clicks = new DoubleClick();
    expect(clicks.click('a', 0)).toBe(false);
    expect(clicks.click('a', DOUBLE_CLICK_MS)).toBe(true);
    expect(clicks.click('a', DOUBLE_CLICK_MS + 10)).toBe(false);
  });

  it('点的不是同一个，或间隔太长，都不算', () => {
    const clicks = new DoubleClick();
    clicks.click('a', 0);
    expect(clicks.click('b', 100)).toBe(false);
    expect(clicks.click('b', 100 + DOUBLE_CLICK_MS + 1)).toBe(false);
  });
});
