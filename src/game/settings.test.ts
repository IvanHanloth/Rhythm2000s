import { describe, expect, it } from 'vite-plus/test';
import { CALIBRATION_LIMIT_MS, PlayerSettings } from './settings.ts';

const defaults = { calibrationMs: 0, skipTutorial: false, beatGuide: false };

describe('PlayerSettings', () => {
  it('clamps the calibration to whole milliseconds within the limit', () => {
    const settings = new PlayerSettings(defaults);
    expect(settings.setCalibrationMs(12.6)).toBe(13);
    expect(settings.setCalibrationMs(-1000)).toBe(-CALIBRATION_LIMIT_MS);
    expect(settings.setCalibrationMs(Number.NaN)).toBe(0);
    expect(new PlayerSettings({ ...defaults, calibrationMs: 999 }).values.calibrationMs).toBe(
      CALIBRATION_LIMIT_MS,
    );
  });

  it('tells listeners about changes until they stop listening', () => {
    const settings = new PlayerSettings(defaults);
    const seen: boolean[] = [];
    const stop = settings.onChange((values) => seen.push(values.beatGuide));
    settings.setBeatGuide(true);
    // No change, no call
    settings.setBeatGuide(true);
    stop();
    settings.setBeatGuide(false);
    expect(seen).toEqual([true]);
    expect(settings.values.beatGuide).toBe(false);
  });

  it('keeps the other values when one changes', () => {
    const settings = new PlayerSettings({
      calibrationMs: 40,
      skipTutorial: true,
      beatGuide: false,
    });
    settings.setBeatGuide(true);
    expect(settings.values).toEqual({ calibrationMs: 40, skipTutorial: true, beatGuide: true });
  });
});
