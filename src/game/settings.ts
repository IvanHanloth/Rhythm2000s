// 玩家设置。目前只有输入校准值，保存在浏览器本地；读写失败（隐私模式等）时退回默认值。

const CALIBRATION_KEY = 'rhythm2000s.calibrationMs';
/** 校准值允许的范围（毫秒） */
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
    // 保存失败只影响下次打开，不影响本次游戏
  }
}
