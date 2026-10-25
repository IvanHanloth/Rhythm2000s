// Synthesised drums and effects; no asset files.
// Every sound attacks on its first sample (only a tiny fade-in against pops), so the scheduled time is the heard beat.

/** Builds a mono AudioBuffer sample by sample. t in sample(t) is in seconds. */
export function renderBuffer(
  context: BaseAudioContext,
  duration: number,
  sample: (t: number) => number,
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const attack = 0.001;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = Math.min(1, t / attack) * sample(t);
  }
  return buffer;
}

/** Exponential decay envelope; tau is the time to fall to 1/e (s) */
function decay(t: number, tau: number): number {
  return Math.exp(-t / tau);
}

/** Kick: a sine sweeping quickly from 150 Hz to 50 Hz. */
export function createKick(context: BaseAudioContext): AudioBuffer {
  let phase = 0;
  const dt = 1 / context.sampleRate;
  return renderBuffer(context, 0.3, (t) => {
    const frequency = 50 + 100 * decay(t, 0.03);
    phase += 2 * Math.PI * frequency * dt;
    return 0.9 * decay(t, 0.08) * Math.sin(phase);
  });
}

/** White noise with a first-order difference to cut the lows, so it sounds sandier. */
function highNoise(): () => number {
  let previous = 0;
  return () => {
    const current = Math.random() * 2 - 1;
    const out = current - previous;
    previous = current;
    return out / 2;
  };
}

/** Snare: noise plus a short 180 Hz body. */
export function createSnare(context: BaseAudioContext): AudioBuffer {
  const noise = highNoise();
  return renderBuffer(context, 0.2, (t) => {
    const body = 0.4 * decay(t, 0.03) * Math.sin(2 * Math.PI * 180 * t);
    return body + 0.5 * decay(t, 0.05) * noise();
  });
}

/** Closed hi-hat: very short high-frequency noise. */
export function createHat(context: BaseAudioContext): AudioBuffer {
  const noise = highNoise();
  return renderBuffer(context, 0.05, (t) => 0.35 * decay(t, 0.012) * noise());
}

export interface BlipOptions {
  /** Start pitch (Hz) */
  from: number;
  /** End pitch (Hz); slides linearly over the duration when it differs from `from` */
  to?: number;
  duration: number;
  gain?: number;
  /** Square sounds more electronic, sine softer */
  wave?: 'sine' | 'square';
}

/** Short electronic blip for UI sounds such as pop-ups, closing and errors. */
export function createBlip(
  context: BaseAudioContext,
  { from, to = from, duration, gain = 0.4, wave = 'sine' }: BlipOptions,
): AudioBuffer {
  let phase = 0;
  const dt = 1 / context.sampleRate;
  return renderBuffer(context, duration, (t) => {
    const frequency = from + (to - from) * Math.min(1, t / duration);
    phase += 2 * Math.PI * frequency * dt;
    const s = Math.sin(phase);
    const shaped = wave === 'square' ? Math.sign(s) * 0.5 : s;
    // Linear fade-out over the last 20% to avoid a click
    const tail = Math.min(1, (duration - t) / (duration * 0.2));
    return gain * tail * shaped;
  });
}

export interface KeystrokeOptions {
  /** Pitch of the key's low body (Hz); lower sounds like a bigger key such as the space bar */
  body: number;
  gain?: number;
}

/** One key press on a keyboard: a sharp noise tick for the key hitting bottom over a short low body. */
export function createKeystroke(
  context: BaseAudioContext,
  { body, gain = 0.5 }: KeystrokeOptions,
): AudioBuffer {
  const noise = highNoise();
  return renderBuffer(context, 0.06, (t) => {
    const tick = 0.7 * decay(t, 0.003) * noise();
    const thock = 0.45 * decay(t, 0.012) * Math.sin(2 * Math.PI * body * t);
    return gain * (tick + thock);
  });
}
