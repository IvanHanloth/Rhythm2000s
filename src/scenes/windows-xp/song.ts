// XP 场景的伴奏和音效（doc/prototypes/mvp.md）。鼓点、节拍器现场合成，MVP 暂定；
// 界面音效用 XP 原版声音，对应关系见 doc/scenes/windows-xp.md「音效」。
// 谱面不在这里，存放在 public/charts/（ADR 0003）。

import type { SequencedSound } from '../../audio/sequencer.ts';
import { createBlip, createHat, createKick, createSnare } from '../../audio/synth.ts';
import { actionTapOffsets, type ActionType } from '../../rhythm/actions.ts';
import type { Chart } from '../../rhythm/chart.ts';
import type { XpSounds } from './assets.ts';
import { DIALOG_KINDS, isDialogKind, type DialogKind } from './dialog-kinds.ts';
import { isShellAction, SHELL_ACTIONS, type ShellAction } from './shell-actions.ts';

export interface PopupSounds {
  kick: AudioBuffer;
  snare: AudioBuffer;
  hat: AudioBuffer;
  /** 预备拍的节拍器点击，重音和普通各一个 */
  countAccent: AudioBuffer;
  count: AudioBuffer;
  /** 示范段弹出各种消息框时的 XP 提示音 */
  dialogs: Record<DialogKind, AudioBuffer>;
  /** 虚拟鼠标左键点下去（关掉消息框）的点击声 */
  close: AudioBuffer;
  /** 右键桌面、弹出右键菜单（desktop-refresh 第一下），暂定 */
  rightClick: AudioBuffer;
  /** 点右键菜单里的「刷新」（desktop-refresh 第二下），暂定 */
  menuCommand: AudioBuffer;
  /** Miss：XP 默认提示音 */
  miss: AudioBuffer;
  /** 一局结束：tada */
  result: AudioBuffer;
  /** 气泡、程序窗口、开始菜单、回收站：示范段出现时的声音（没有则为 null）和跟打段命中时的声音 */
  shell: Record<ShellAction, { appear: AudioBuffer | null; handled: AudioBuffer }>;
}

export function createPopupSounds(context: BaseAudioContext, xp: XpSounds): PopupSounds {
  const dialogs = Object.fromEntries(
    Object.entries(DIALOG_KINDS).map(([kind, info]) => [kind, xp[info.sound]]),
  ) as Record<DialogKind, AudioBuffer>;
  return {
    kick: createKick(context),
    snare: createSnare(context),
    hat: createHat(context),
    countAccent: createBlip(context, { from: 1760, duration: 0.05, gain: 0.5 }),
    count: createBlip(context, { from: 880, duration: 0.05, gain: 0.5 }),
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
    ) as PopupSounds['shell'],
  };
}

/**
 * 虚拟鼠标点某个动作的第 step 下时响的声音：消息框是点击声；
 * desktop-refresh 第一下右键、第二下点「刷新」。示范段按拍点预约，跟打段命中时立即播放。
 */
export function clickSound(sounds: PopupSounds, action: ActionType, step: number): AudioBuffer {
  if (action === 'desktop-refresh') return step === 0 ? sounds.rightClick : sounds.menuCommand;
  // 开始菜单：第一下按「开始」是点击声，第二下点菜单项
  if (action === 'start-menu') return step === 0 ? sounds.close : sounds.shell[action].handled;
  if (isShellAction(action)) return sounds.shell[action].handled;
  return sounds.close;
}

/**
 * 伴奏：预备小节打节拍器，示范 / 跟打小节「底鼓、军鼓交替，每半拍踩镲」，空档只有踩镲，结尾只收一下；
 * 再加上示范段的提示音：消息框弹出的提示音，以及虚拟鼠标示范 desktop-refresh 的两下。
 */
export function buildBackingTrack(chart: Chart, sounds: PopupSounds): SequencedSound[] {
  const { beatsPerBar } = chart;
  const track: SequencedSound[] = [];
  const firstBodyBeat = chart.phrases[0]?.callStart ?? beatsPerBar;
  const lastBodyBeat = chart.phrases.at(-1)?.end ?? firstBodyBeat;

  // 预备小节：节拍器点击（每小节第 1 拍重音）+ 每半拍踩镲
  for (let beat = 0; beat < firstBodyBeat; beat++) {
    track.push({ beat, buffer: beat % beatsPerBar === 0 ? sounds.countAccent : sounds.count });
  }
  for (let half = 0; half / 2 < firstBodyBeat; half++) {
    track.push({ beat: half / 2, buffer: sounds.hat, gain: 0.6 });
  }

  // 示范小节和跟打小节：鼓点各自从小节第 1 拍开始（底鼓、军鼓交替，每半拍踩镲），
  // 这样空档不是整拍时，跟打的拍子也和鼓点对齐。
  // 空档：只留踩镲，底鼓和军鼓停下，让玩家听出「停了一下」。
  for (const phrase of chart.phrases) {
    pushBar(track, sounds, phrase.callStart, phrase.callEnd);
    for (let beat = phrase.callEnd; beat < phrase.responseStart; beat += 0.5) {
      track.push({ beat, buffer: sounds.hat, gain: 0.5 });
    }
    pushBar(track, sounds, phrase.responseStart, phrase.end);
  }

  // 结尾只收一下
  track.push(
    { beat: lastBodyBeat, buffer: sounds.kick },
    { beat: lastBodyBeat, buffer: sounds.snare },
  );

  for (const call of chart.calls) {
    const appear = isShellAction(call.action) ? sounds.shell[call.action].appear : null;
    if (isDialogKind(call.action)) {
      track.push({ beat: call.beat, buffer: sounds.dialogs[call.action] });
    } else if (appear) {
      // 气泡、程序窗口、文件：示范段只是出现，响出现的声音
      track.push({ beat: call.beat, buffer: appear });
    } else {
      actionTapOffsets(call.action).forEach((offset, step) => {
        track.push({ beat: call.beat + offset, buffer: clickSound(sounds, call.action, step) });
      });
    }
  }
  return track;
}

/** 从 start 到 end 打一段鼓点：整拍上底鼓、军鼓交替（从底鼓开始），每半拍踩镲。 */
function pushBar(track: SequencedSound[], sounds: PopupSounds, start: number, end: number): void {
  for (let half = 0; start + half / 2 < end; half++) {
    const beat = start + half / 2;
    track.push({ beat, buffer: sounds.hat, gain: half % 2 === 0 ? 0.8 : 0.5 });
    if (half % 2 === 0) {
      track.push({ beat, buffer: (half / 2) % 2 === 0 ? sounds.kick : sounds.snare });
    }
  }
}
