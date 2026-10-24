// 动画缓动函数。输入是 0～1 的进度，按音频时钟算出来，不依赖帧数。

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 先冲过头再回弹，用于窗口弹出。 */
export function easeOutBack(progress: number): number {
  const p = clamp01(progress);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
}

export function easeOutCubic(progress: number): number {
  return 1 - (1 - clamp01(progress)) ** 3;
}
