// Player settings: input calibration, skipping the tutorial and the beat guide (doc/settings.md), kept in browser storage;
// read / write failures (private mode etc.) fall back to defaults. One PlayerSettings is shared by the shell and the
// scenes; the settings window and the H key both change it, and listeners keep every view in step.

const CALIBRATION_KEY = 'rhythm2000s.calibrationMs';
const SKIP_TUTORIAL_KEY = 'rhythm2000s.skipTutorial';
const BEAT_GUIDE_KEY = 'rhythm2000s.beatGuide';

/** Allowed calibration range (ms) */
export const CALIBRATION_LIMIT_MS = 300;

export function clampCalibrationMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(CALIBRATION_LIMIT_MS, Math.max(-CALIBRATION_LIMIT_MS, value)));
}

export interface SettingValues {
  /** Input calibration (ms); positive means the player presses late */
  calibrationMs: number;
  /** Skip the per-action demo (doc/level-design.md "Rule 1") */
  skipTutorial: boolean;
  /** Beat guide on (doc/beat-guide.md); H toggles it in a level */
  beatGuide: boolean;
}

export class PlayerSettings {
  private current: SettingValues;
  private readonly listeners = new Set<(values: SettingValues) => void>();

  constructor(values: SettingValues = loadSettings()) {
    this.current = { ...values, calibrationMs: clampCalibrationMs(values.calibrationMs) };
  }

  get values(): Readonly<SettingValues> {
    return this.current;
  }

  /** Clamps to ±CALIBRATION_LIMIT_MS whole milliseconds; returns the value actually used */
  setCalibrationMs(value: number): number {
    const calibrationMs = clampCalibrationMs(value);
    this.update({ calibrationMs });
    return calibrationMs;
  }

  setSkipTutorial(skipTutorial: boolean): void {
    this.update({ skipTutorial });
  }

  setBeatGuide(beatGuide: boolean): void {
    this.update({ beatGuide });
  }

  /** Called after every change; returns a function that stops listening */
  onChange(listener: (values: SettingValues) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(change: Partial<SettingValues>): void {
    const next = { ...this.current, ...change };
    if (
      next.calibrationMs === this.current.calibrationMs &&
      next.skipTutorial === this.current.skipTutorial &&
      next.beatGuide === this.current.beatGuide
    )
      return;
    this.current = next;
    saveSettings(next);
    for (const listener of this.listeners) listener(next);
  }
}

function loadSettings(): SettingValues {
  return {
    calibrationMs: clampCalibrationMs(Number(read(CALIBRATION_KEY) ?? 0)),
    skipTutorial: read(SKIP_TUTORIAL_KEY) === '1',
    beatGuide: read(BEAT_GUIDE_KEY) === '1',
  };
}

function saveSettings(values: SettingValues): void {
  write(CALIBRATION_KEY, String(values.calibrationMs));
  write(SKIP_TUTORIAL_KEY, values.skipTutorial ? '1' : '0');
  write(BEAT_GUIDE_KEY, values.beatGuide ? '1' : '0');
}

/** null when unset or when storage can't be read */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A failed save only affects the next visit, not this one
  }
}
