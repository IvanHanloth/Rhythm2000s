// Player settings. Only input calibration for now, kept in browser storage; read / write failures fall back to defaults.

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
