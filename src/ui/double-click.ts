// Double-click detection: icons in the level select are "click to select, double-click to open", like the real OS.
// UI only, not part of rhythm judging, so performance.now() is fine.

/** Windows' and Mac OS X's default double-click interval is about 500 ms */
export const DOUBLE_CLICK_MS = 500;

export class DoubleClick {
  private last: { key: string; time: number } | null = null;

  /** Records a click; true when it is on the same thing as the last one and soon enough (then the count resets) */
  click(key: string, time: number): boolean {
    const last = this.last;
    if (last && last.key === key && time - last.time <= DOUBLE_CLICK_MS) {
      this.last = null;
      return true;
    }
    this.last = { key, time };
    return false;
  }
}
