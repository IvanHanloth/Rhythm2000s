// Player settings: input calibration and skipping the tutorial (doc/settings.md), kept in browser storage;
// read / write failures (private mode etc.) fall back to defaults.

const CALIBRATION_KEY = 'rhythm2000s.calibrationMs';
/** Allowed calibration range (ms) */
export const CALIBRATION_LIMIT_MS = 300;

export function clampCalibrationMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(CALIBRATION_LIMIT_MS, Math.max(-CALIBRATION_LIMIT_MS, value)));
}

export function loadCalibrationMs(): number {
  try {
    return clampCalibrationMs(Number(localStorage.getItem(CALIBRATION_KEY) ?? 0));
  } catch {
    return 0;
  }
}

export function saveCalibrationMs(value: number): void {
  try {
    localStorage.setItem(CALIBRATION_KEY, String(value));
  } catch {
    // A failed save only affects the next visit, not this one
  }
}

const SKIP_TUTORIAL_KEY = 'rhythm2000s.skipTutorial';

/** 跳过操作演示（doc/level-design.md「规则 1」），默认不跳过 */
export function loadSkipTutorial(): boolean {
  try {
    return localStorage.getItem(SKIP_TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSkipTutorial(skip: boolean): void {
  try {
    localStorage.setItem(SKIP_TUTORIAL_KEY, skip ? '1' : '0');
  } catch {
    // 保存失败只影响下次打开，不影响本次游戏
  }
}
