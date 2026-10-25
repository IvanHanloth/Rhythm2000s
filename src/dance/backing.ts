// The dance machine's backing track (doc/dance-machine.md "Sound"), synthesised like the scenes' drums (provisional):
// a metronome count-in, then the shared drum pattern and a square-wave bass on a four-bar chord loop, ending on one hit.

import type { SequencedSound } from '@/audio/sequencer.ts';
import { createBlip } from '@/audio/synth.ts';
import { createDrumKit, drumBars, type DrumKit } from '@/scenes/shared/backing-track.ts';
import { firstStepBeat, songBeats, type DanceChart } from './steps.ts';

/** Bass roots of the four-bar loop (Hz): A minor, F, C, G */
const CHORD_ROOTS = [110, 87.31, 130.81, 98];

export interface DanceKit {
  drums: DrumKit;
  /** Per chord: the root and the octave above */
  bass: { low: AudioBuffer; high: AudioBuffer }[];
}

export function createDanceKit(context: BaseAudioContext): DanceKit {
  const note = (from: number) =>
    createBlip(context, { from, duration: 0.14, gain: 0.22, wave: 'square' });
  return {
    drums: createDrumKit(context),
    bass: CHORD_ROOTS.map((root) => ({ low: note(root), high: note(root * 2) })),
  };
}

export function buildDanceTrack(chart: DanceChart, kit: DanceKit): SequencedSound[] {
  const { beatsPerBar } = chart;
  const { drums } = kit;
  const start = firstStepBeat(chart);
  const end = songBeats(chart) - chart.outroBars * beatsPerBar;
  const track: SequencedSound[] = [];

  for (let beat = 0; beat < start; beat++) {
    track.push({ beat, buffer: beat % beatsPerBar === 0 ? drums.countAccent : drums.count });
  }
  for (let half = 0; half / 2 < start; half++) {
    track.push({ beat: half / 2, buffer: drums.hat, gain: 0.6 });
  }

  drumBars(track, drums, start, end);
  for (let half = 0; start + half / 2 < end; half++) {
    const beat = start + half / 2;
    const bar = Math.floor((beat - start) / beatsPerBar);
    const chord = kit.bass[bar % kit.bass.length]!;
    track.push({ beat, buffer: half % 2 === 0 ? chord.low : chord.high });
  }

  track.push({ beat: end, buffer: drums.kick }, { beat: end, buffer: drums.snare });
  track.push({ beat: end, buffer: kit.bass[0]!.low });
  return track;
}
