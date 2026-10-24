// Beat ↔ audio time. Times are in seconds on the AudioContext timeline.

export function secondsPerBeat(bpm: number): number {
  if (!(bpm > 0)) {
    throw new RangeError(`BPM must be greater than 0, got ${bpm}`);
  }
  return 60 / bpm;
}

/** Audio time of `beat`. startTime is the time of beat 0. */
export function beatToTime(startTime: number, bpm: number, beat: number): number {
  return startTime + beat * secondsPerBeat(bpm);
}

/** Beat position at an audio time (may be fractional or negative). */
export function timeToBeat(startTime: number, bpm: number, time: number): number {
  return (time - startTime) / secondsPerBeat(bpm);
}

export interface NearestBeat {
  /** Nearest beat index, never below 0 */
  beat: number;
  /** Offset from that beat (s); positive is late, negative is early */
  offset: number;
}

/** The beat nearest to `time`, with the offset. */
export function nearestBeat(startTime: number, bpm: number, time: number): NearestBeat {
  const beat = Math.max(0, Math.round(timeToBeat(startTime, bpm, time)));
  return { beat, offset: time - beatToTime(startTime, bpm, beat) };
}
