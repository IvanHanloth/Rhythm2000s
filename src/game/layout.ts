// Canvas size and fit: scenes draw at a fixed logical resolution, then scale uniformly into the window (ADR 0002).

/** Logical resolution every scene draws in. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export interface Fit {
  /** Scale from logical to screen coordinates */
  scale: number;
  /** Top-left of the picture on screen (CSS pixels) */
  x: number;
  y: number;
}

/** Fits a designW×designH picture into a screenW×screenH screen, centred, letterboxing the rest. */
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
