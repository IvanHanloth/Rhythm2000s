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

/** Skip the per-action demo (doc/level-design.md "Rule 1"); off by default */
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
    // A failed save only affects the next visit
  }
}

const BEAT_GUIDE_KEY = 'rhythm2000s.beatGuide';

/** Beat guide (doc/beat-guide.md), toggled with H in a level; off by default */
export function loadBeatGuide(): boolean {
  try {
    return localStorage.getItem(BEAT_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBeatGuide(on: boolean): void {
  try {
    localStorage.setItem(BEAT_GUIDE_KEY, on ? '1' : '0');
  } catch {
    // A failed save only affects the next visit
  }
}
