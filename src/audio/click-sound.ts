// Synthesised metronome click; no audio assets needed.

export interface ClickOptions {
  /** Pitch (Hz) */
  frequency: number;
  /** Duration (s) */
  duration?: number;
  /** Volume (0…1) */
  gain?: number;
}

/**
 * A short click whose attack starts on the very first sample (only a 1 ms fade-in to avoid pops),
 * so the scheduled time is where the beat is heard.
 */
export function createClickBuffer(
  context: BaseAudioContext,
  { frequency, duration = 0.05, gain = 0.6 }: ClickOptions,
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const attack = Math.max(1, Math.round(0.001 * sampleRate));
  const decay = duration / 6;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, i / attack) * Math.exp(-t / decay);
    data[i] = gain * envelope * Math.sin(2 * Math.PI * frequency * t);
  }
  return buffer;
}
