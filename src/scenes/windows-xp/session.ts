// One round of an XP level (doc/scenes/windows-xp-levels.md "Judging"): every chart event is a plain call/response pair.

import type { SceneContext } from '@/game/scene.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { pairTargets, RoundSession, type RoundTarget } from '@/scenes/shared/round-session.ts';
import { buildBackingTrack, hitSound, type XpSongSounds } from './song.ts';

export type XpTarget = RoundTarget;

export class XpSession extends RoundSession<XpTarget> {
  /** `startTime`: audio time of beat 0, see RoundSessionOptions */
  constructor(context: SceneContext, chart: Chart, sounds: XpSongSounds, startTime?: number) {
    super(context, chart, {
      targets: pairTargets(chart),
      backingTrack: buildBackingTrack(chart, sounds),
      hitSound: (target, step) => hitSound(sounds, target.response.action, step),
      missSound: sounds.miss,
      startTime,
    });
  }
}
