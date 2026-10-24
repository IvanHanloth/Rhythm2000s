// One run of the in-game latency test (doc/latency-test.md): count-in clicks, then measured clicks; presses are
// matched to the nearest measured beat and the offsets give a suggested calibration. Pure: times are audio times (s)
// in, offsets in ms out; the windows schedule the clicks and draw.

import { beatToTime, secondsPerBeat } from '@/rhythm/beat.ts';
import { suggestCalibration, summarize } from './stats.ts';

export const TEST_BPM = 120;
export const COUNT_IN_CLICKS = 4;
export const MEASURED_BEATS = 8;
/** Presses needed before a value is suggested */
export const MIN_PRESSES = 5;

export type TestPhase =
  | { kind: 'waiting' }
  /** click: the count-in click last heard, 1 … COUNT_IN_CLICKS */
  | { kind: 'count-in'; click: number }
  | { kind: 'measuring'; beat: number }
  | { kind: 'done' };

export interface TestResult {
  presses: number;
  /** Mean offset (ms), positive late; null without presses */
  meanMs: number | null;
  /** Standard deviation (ms); null without presses */
  spreadMs: number | null;
  /** Suggested calibration (whole ms); null with fewer than MIN_PRESSES presses */
  suggestionMs: number | null;
}

export class LatencyTestRun {
  /** Offset (ms) of the press on each measured beat, null until pressed */
  readonly offsetsMs: (number | null)[] = Array.from({ length: MEASURED_BEATS }, () => null);
  private readonly startTime: number;
  private readonly bpm: number;

  /** startTime: audio time of the first count-in click */
  constructor(startTime: number, bpm = TEST_BPM) {
    this.startTime = startTime;
    this.bpm = bpm;
  }

  /** Audio time of click `index`, count-in included (0 … COUNT_IN_CLICKS + MEASURED_BEATS − 1) */
  clickTime(index: number): number {
    return beatToTime(this.startTime, this.bpm, index);
  }

  /** Audio time of measured beat `beat` (0 … MEASURED_BEATS − 1) */
  beatTime(beat: number): number {
    return this.clickTime(COUNT_IN_CLICKS + beat);
  }

  /** Half a beat after the last measured click, when presses stop counting */
  get endTime(): number {
    return this.beatTime(MEASURED_BEATS - 1) + secondsPerBeat(this.bpm) / 2;
  }

  /** Where the run is at a heard audio time; a beat is current from half a beat before its click */
  phaseAt(time: number): TestPhase {
    if (time < this.startTime) return { kind: 'waiting' };
    if (time >= this.endTime) return { kind: 'done' };
    const half = secondsPerBeat(this.bpm) / 2;
    if (time < this.beatTime(0) - half) {
      const click = Math.floor((time - this.startTime) / secondsPerBeat(this.bpm)) + 1;
      return { kind: 'count-in', click: Math.min(COUNT_IN_CLICKS, click) };
    }
    const beat = Math.round((time - this.beatTime(0)) / secondsPerBeat(this.bpm));
    return { kind: 'measuring', beat: Math.min(MEASURED_BEATS - 1, Math.max(0, beat)) };
  }

  /**
   * A press at a heard audio time: matched to the nearest measured beat within half a beat. Returns that beat,
   * or null when it falls outside every beat or the beat already has a press.
   */
  press(time: number): number | null {
    const beat = Math.round((time - this.beatTime(0)) / secondsPerBeat(this.bpm));
    if (beat < 0 || beat >= MEASURED_BEATS || this.offsetsMs[beat] !== null) return null;
    const offset = time - this.beatTime(beat);
    if (Math.abs(offset) > secondsPerBeat(this.bpm) / 2) return null;
    this.offsetsMs[beat] = offset * 1000;
    return beat;
  }

  result(): TestResult {
    const pressed = this.offsetsMs.filter((offset) => offset !== null);
    const summary = summarize(pressed);
    const suggestion =
      pressed.length >= MIN_PRESSES
        ? suggestCalibration(pressed, { skipFirst: 0, trimFraction: 0.1, minSamples: MIN_PRESSES })
        : null;
    return {
      presses: pressed.length,
      meanMs: pressed.length > 0 ? summary.mean : null,
      spreadMs: pressed.length > 0 ? summary.stdDev : null,
      suggestionMs: suggestion === null ? null : Math.round(suggestion),
    };
  }
}
