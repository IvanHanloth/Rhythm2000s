// XP backing track and sound effects. Interface sounds are the original XP sounds,
// mapped in doc/scenes/windows-xp.md "Sounds".

import type { SequencedSound } from '@/audio/sequencer.ts';
import { actionTapOffsets, type ActionType } from '@/rhythm/actions.ts';
import type { Chart } from '@/rhythm/chart.ts';
import { buildDrumTrack, createDrumKit, type DrumKit } from '@/scenes/shared/backing-track.ts';
import type { XpSounds } from './assets.ts';
import { DIALOG_KINDS, isDialogKind, type DialogKind } from './dialog-kinds.ts';
import { isShellAction, SHELL_ACTIONS, type ShellAction } from './shell-actions.ts';

export interface XpSongSounds extends DrumKit {
  /** Alert sound for each message box popping up in the call */
  dialogs: Record<DialogKind, AudioBuffer>;
  /** Left click of the virtual mouse (closing a message box) */
  close: AudioBuffer;
  /** desktop-refresh: right-click on the desktop, then "Refresh" in the menu */
  rightClick: AudioBuffer;
  menuCommand: AudioBuffer;
  miss: AudioBuffer;
  /** End of a round: tada */
  result: AudioBuffer;
  /** Balloon, program window, Start menu, Recycle Bin: sound when it appears in the call (if any) and when handled */
  shell: Record<ShellAction, { appear: AudioBuffer | null; handled: AudioBuffer }>;
  /** progress-download: the window opens (in both call and response), then "Open" once the bar fills */
  download: { appear: AudioBuffer; open: AudioBuffer };
  /** volume-mute releasing the slider; the press uses `close` */
  volumeRelease: AudioBuffer;
  /** chair-swivel landing back in the monitor; the press uses `close` (provisional, doc/cross-dimension.md) */
  chairLand: AudioBuffer;
}

export function createXpSongSounds(context: BaseAudioContext, xp: XpSounds): XpSongSounds {
  const dialogs = Object.fromEntries(
    Object.entries(DIALOG_KINDS).map(([kind, info]) => [kind, xp[info.sound]]),
  ) as Record<DialogKind, AudioBuffer>;
  return {
    ...createDrumKit(context),
    dialogs,
    close: xp.navigate,
    rightClick: xp.navigate,
    menuCommand: xp.menuCommand,
    miss: xp.defaultBeep,
    result: xp.tada,
    shell: Object.fromEntries(
      Object.entries(SHELL_ACTIONS).map(([action, info]) => [
        action,
        { appear: info.appear ? xp[info.appear] : null, handled: xp[info.handled] },
      ]),
    ) as XpSongSounds['shell'],
    download: { appear: xp.downloadStart, open: xp.downloadOpen },
    volumeRelease: xp.volumeRelease,
    chairLand: xp.restore,
  };
}

/** Sound of the step-th press of an action: booked on the beat in the call, played on the hit in the response. */
export function hitSound(sounds: XpSongSounds, action: ActionType, step: number): AudioBuffer {
  if (action === 'desktop-refresh') return step === 0 ? sounds.rightClick : sounds.menuCommand;
  if (action === 'progress-download') return sounds.download.open;
  if (action === 'volume-mute') return step === 0 ? sounds.close : sounds.volumeRelease;
  if (action === 'chair-swivel') return step === 0 ? sounds.close : sounds.chairLand;
  if (action === 'start-menu') return step === 0 ? sounds.close : sounds.shell[action].handled;
  if (isShellAction(action)) return sounds.shell[action].handled;
  return sounds.close;
}

/**
 * Drums plus the call cues: message boxes play their alert sound, shell targets their appear sound,
 * and the other actions the virtual mouse's presses. The download window also opens by itself in the response.
 */
export function buildBackingTrack(chart: Chart, sounds: XpSongSounds): SequencedSound[] {
  const track = buildDrumTrack(chart, sounds);
  const pushPresses = (beat: number, action: ActionType) => {
    actionTapOffsets(action).forEach((offset, step) => {
      track.push({ beat: beat + offset, buffer: hitSound(sounds, action, step) });
    });
  };

  for (const { beat, action } of chart.calls) {
    const appear = isShellAction(action) ? sounds.shell[action].appear : null;
    if (isDialogKind(action)) {
      track.push({ beat, buffer: sounds.dialogs[action] });
    } else if (action === 'progress-download') {
      track.push({ beat, buffer: sounds.download.appear });
      pushPresses(beat, action);
    } else if (appear) {
      track.push({ beat, buffer: appear });
    } else {
      pushPresses(beat, action);
    }
  }
  for (const { beat, action } of chart.responses) {
    if (action === 'progress-download') track.push({ beat, buffer: sounds.download.appear });
  }
  return track;
}
