// The drum part every scene's backing track shares, synthesised on the spot (provisional, like the scene sounds).
// Count-in bars play a metronome; call and response bars alternate kick and snare with a hi-hat every half beat;
// the gap between them keeps only the hi-hat so the player hears the band stop; the song ends on a single hit.
// Scenes add their own cues on top (doc/scenes/windows-xp.md, doc/scenes/mac-2000.md "Sounds").

import type { SequencedSound } from '@/audio/sequencer.ts';
import { createBlip, createHat, createKick, createSnare } from '@/audio/synth.ts';
import type { Chart } from '@/rhythm/chart.ts';

export interface DrumKit {
  kick: AudioBuffer;
  snare: AudioBuffer;
  hat: AudioBuffer;
  /** Count-in metronome clicks: accented and plain */
  countAccent: AudioBuffer;
  count: AudioBuffer;
}

export function createDrumKit(context: BaseAudioContext): DrumKit {
  return {
    kick: createKick(context),
    snare: createSnare(context),
    hat: createHat(context),
    countAccent: createBlip(context, { from: 1760, duration: 0.05, gain: 0.5 }),
    count: createBlip(context, { from: 880, duration: 0.05, gain: 0.5 }),
  };
}

export function buildDrumTrack(chart: Chart, kit: DrumKit): SequencedSound[] {
  const { beatsPerBar } = chart;
  const track: SequencedSound[] = [];
  const firstBodyBeat = chart.phrases[0]?.callStart ?? beatsPerBar;
  const lastBodyBeat = chart.phrases.at(-1)?.end ?? firstBodyBeat;

  // Count-in: metronome (accent on the first beat of each bar) plus a hi-hat every half beat
  for (let beat = 0; beat < firstBodyBeat; beat++) {
    track.push({ beat, buffer: beat % beatsPerBar === 0 ? kit.countAccent : kit.count });
  }
  for (let half = 0; half / 2 < firstBodyBeat; half++) {
    track.push({ beat: half / 2, buffer: kit.hat, gain: 0.6 });
  }

  // Call and response bars each restart the pattern on their first beat, so the response stays
  // on the drum grid even when the gap is not a whole number of beats
  for (const phrase of chart.phrases) {
    drumBars(track, kit, phrase.callStart, phrase.callEnd);
    for (let beat = phrase.callEnd; beat < phrase.responseStart; beat += 0.5) {
      track.push({ beat, buffer: kit.hat, gain: 0.5 });
    }
    drumBars(track, kit, phrase.responseStart, phrase.end);
  }

  track.push({ beat: lastBodyBeat, buffer: kit.kick }, { beat: lastBodyBeat, buffer: kit.snare });
  return track;
}

/** Drums from start to end: kick and snare alternate on whole beats (kick first), hi-hat every half beat. */
export function drumBars(track: SequencedSound[], kit: DrumKit, start: number, end: number): void {
  for (let half = 0; start + half / 2 < end; half++) {
    const beat = start + half / 2;
    track.push({ beat, buffer: kit.hat, gain: half % 2 === 0 ? 0.8 : 0.5 });
    if (half % 2 === 0) {
      track.push({ beat, buffer: (half / 2) % 2 === 0 ? kit.kick : kit.snare });
    }
  }
}
