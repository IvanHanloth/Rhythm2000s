// 双击判断：选关界面里图标「单击选中、双击打开」，和原版系统一样。
// 只用于界面操作，不参与节奏判定，所以用 performance.now() 就够了。

/** Windows 和 Mac OS X 的默认双击间隔都在 500 毫秒左右 */
export const DOUBLE_CLICK_MS = 500;

export class DoubleClick {
  private last: { key: string; time: number } | null = null;

  /** 记录一次单击；和上一次点的是同一个东西且间隔够短时返回 true（之后重新计数） */
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
