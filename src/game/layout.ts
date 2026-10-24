// 画布尺寸与适配：场景按固定的逻辑分辨率绘制，再整体等比缩放到窗口里（ADR 0002）。

/** 逻辑分辨率：所有场景都按这个坐标系绘制。 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export interface Fit {
  /** 逻辑坐标到屏幕坐标的缩放倍数 */
  scale: number;
  /** 画面左上角在屏幕上的位置（CSS 像素） */
  x: number;
  y: number;
}

/** 把 designW×designH 的画面等比放进 screenW×screenH 的屏幕，居中，多出的部分留黑边。 */
export function fitToScreen(
  screenWidth: number,
  screenHeight: number,
  designWidth = DESIGN_WIDTH,
  designHeight = DESIGN_HEIGHT,
): Fit {
  if (!(screenWidth > 0 && screenHeight > 0)) {
    return { scale: 0, x: 0, y: 0 };
  }
  const scale = Math.min(screenWidth / designWidth, screenHeight / designHeight);
  return {
    scale,
    x: (screenWidth - designWidth * scale) / 2,
    y: (screenHeight - designHeight * scale) / 2,
  };
}
