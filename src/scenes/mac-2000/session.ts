// One round of a Mac level (doc/scenes/mac-2000.md "Gameplay"). On top of the shared round,
// each target knows its widget kind and its place among same-kind targets in the phrase.

import type { SceneContext } from '@/game/scene.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { createClicks, RoundSession, type RoundTarget } from '@/scenes/shared/round-session.ts';
import {
  isMacAction,
  MAC_ACTIONS,
  usesWindowSlot,
  type MacAction,
  type MacTargetKind,
} from './action-kinds.ts';
import { buildBackingTrack, hitSound, type MacSongSounds } from './song.ts';

/** Something the player deals with: an alert, a bouncing icon, new mail, a window, a menu, a file… */
export interface MacTarget extends RoundTarget {
  action: MacAction;
  kind: MacTargetKind;
  /**
   * Position among same-kind targets in the phrase (from 0), which decides where it is drawn:
   * alerts and windows share the screen slots, dock-bounce picks the icon, files pick the cell;
   * mail and menus only use it for ordering.
   */
  order: number;
}

/** Alerts, windows and sheet windows share one set of screen slots */
function slotGroup(kind: MacTargetKind): string {
  return usesWindowSlot(kind) ? 'screen' : kind;
}

/** Pairs the chart's call and response events into targets. The chart must have passed checkMacChart. */
export function buildTargets(chart: Chart): MacTarget[] {
  const counters = new Map<string, number>();
  return chart.calls.map((call, i) => {
    const action: MacAction = isMacAction(call.action) ? call.action : 'alert-note';
    const kind = MAC_ACTIONS[action].kind;
    const key = `${call.phrase}:${slotGroup(kind)}`;
    const order = counters.get(key) ?? 0;
    counters.set(key, order + 1);
    const response = chart.responses[i]!;
    return {
      call,
      response,
      action,
      kind,
      order,
      clicks: createClicks(response),
      handledAt: null,
      missedAt: null,
    };
  });
}

export class MacSession extends RoundSession<MacTarget> {
  /** `startTime`: audio time of beat 0, see RoundSessionOptions */
  constructor(context: SceneContext, chart: Chart, sounds: MacSongSounds, startTime?: number) {
    super(context, chart, {
      targets: buildTargets(chart),
      backingTrack: buildBackingTrack(chart, sounds),
      hitSound: (target, step) => hitSound(sounds, target.action, step),
      missSound: sounds.miss,
      startTime,
    });
  }
}
