// Mac backing track and sound effects (doc/scenes/mac-2000.md "Sounds"): the shared drums
// plus the original Mac OS X alert sounds.

import type { SequencedSound } from '@/audio/sequencer.ts';
import { actionTapOffsets } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { buildDrumTrack, createDrumKit, type DrumKit } from '@/scenes/shared/backing-track.ts';
import { isMacAction, MAC_ACTIONS, macHandledSound, type MacAction } from './action-kinds.ts';
import type { MacSounds } from './assets.ts';

export interface MacSongSounds extends DrumKit {
  /** Cue each action plays on its beat in the call */
  actions: Record<MacAction, AudioBuffer>;
  /** Original alert sounds by file name */
  byName: MacSounds;
  miss: AudioBuffer;
  /** End of a round */
  result: AudioBuffer;
}

export function createMacSongSounds(context: BaseAudioContext, mac: MacSounds): MacSongSounds {
  const actions = Object.fromEntries(
    Object.entries(MAC_ACTIONS).map(([action, info]) => [action, mac[info.sound]]),
  ) as Record<MacAction, AudioBuffer>;
  return {
    ...createDrumKit(context),
    actions,
    byName: mac,
    miss: mac.Sosumi,
    result: mac.Hero,
  };
}

/** Drums plus each call action's cue; two-press actions also sound their later presses on the beat. */
export function buildBackingTrack(chart: Chart, sounds: MacSongSounds): SequencedSound[] {
  const track = buildDrumTrack(chart, sounds);
  for (const call of chart.calls) {
    if (!isMacAction(call.action)) continue;
    const action = call.action;
    track.push({ beat: call.beat, buffer: sounds.actions[action] });
    actionTapOffsets(action).forEach((offset, step) => {
      if (step > 0)
        track.push({ beat: call.beat + offset, buffer: hitSound(sounds, action, step) });
    });
  }
  return track;
}

/** Sound of the step-th press of an action when it hits */
export function hitSound(sounds: MacSongSounds, action: MacAction, step: number): AudioBuffer {
  return sounds.byName[macHandledSound(action, step)];
}
