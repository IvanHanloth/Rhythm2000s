// Mac 场景的伴奏和音效（doc/scenes/mac-2000.md「音效」）。鼓点、节拍器现场合成，与 XP 场景相同，都是暂定；
// 界面音效用 Mac OS X 原版提示音。谱面存放在 public/charts/（ADR 0003）。

import type { SequencedSound } from '../../audio/sequencer.ts';
import { createBlip, createHat, createKick, createSnare } from '../../audio/synth.ts';
import type { Chart } from '../../rhythm/chart.ts';
import { isMacAction, MAC_ACTIONS, type MacAction } from './action-kinds.ts';
import type { MacSounds } from './assets.ts';

export interface MacSongSounds {
  kick: AudioBuffer;
  snare: AudioBuffer;
  hat: AudioBuffer;
  /** 预备拍的节拍器点击，重音和普通各一个 */
  countAccent: AudioBuffer;
  count: AudioBuffer;
  /** 示范段各动作在拍点上的提示音 */
  actions: Record<MacAction, AudioBuffer>;
  /** 玩家处理掉一个目标 */
  handled: AudioBuffer;
  miss: AudioBuffer;
  /** 一局结束 */
  result: AudioBuffer;
}

export function createMacSongSounds(context: BaseAudioContext, mac: MacSounds): MacSongSounds {
  const actions = Object.fromEntries(
    Object.entries(MAC_ACTIONS).map(([action, info]) => [action, mac[info.sound]]),
  ) as Record<MacAction, AudioBuffer>;
  return {
    kick: createKick(context),
    snare: createSnare(context),
    hat: createHat(context),
    countAccent: createBlip(context, { from: 1760, duration: 0.05, gain: 0.5 }),
    count: createBlip(context, { from: 880, duration: 0.05, gain: 0.5 }),
    actions,
    handled: mac.Tink,
    miss: mac.Sosumi,
    result: mac.Hero,
  };
}

/**
 * 伴奏：预备小节打节拍器，示范 / 跟打小节「底鼓、军鼓交替，每半拍踩镲」，空档只有踩镲，结尾只收一下；
 * 再加上示范段各动作的提示音。跟打段不提示动作。
 */
export function buildBackingTrack(chart: Chart, sounds: MacSongSounds): SequencedSound[] {
  const { beatsPerBar } = chart;
  const track: SequencedSound[] = [];
  const firstBodyBeat = chart.phrases[0]?.callStart ?? beatsPerBar;
  const lastBodyBeat = chart.phrases.at(-1)?.end ?? firstBodyBeat;

  for (let beat = 0; beat < firstBodyBeat; beat++) {
    track.push({ beat, buffer: beat % beatsPerBar === 0 ? sounds.countAccent : sounds.count });
  }
  for (let half = 0; half / 2 < firstBodyBeat; half++) {
    track.push({ beat: half / 2, buffer: sounds.hat, gain: 0.6 });
  }

  // 示范小节和跟打小节的鼓点各自从小节第 1 拍开始，空档不是整拍时跟打的拍子也和鼓点对齐
  for (const phrase of chart.phrases) {
    pushBar(track, sounds, phrase.callStart, phrase.callEnd);
    for (let beat = phrase.callEnd; beat < phrase.responseStart; beat += 0.5) {
      track.push({ beat, buffer: sounds.hat, gain: 0.5 });
    }
    pushBar(track, sounds, phrase.responseStart, phrase.end);
  }

  track.push(
    { beat: lastBodyBeat, buffer: sounds.kick },
    { beat: lastBodyBeat, buffer: sounds.snare },
  );

  for (const call of chart.calls) {
    if (isMacAction(call.action)) {
      track.push({ beat: call.beat, buffer: sounds.actions[call.action] });
    }
  }
  return track;
}

/** 从 start 到 end 打一段鼓点：整拍上底鼓、军鼓交替（从底鼓开始），每半拍踩镲。 */
function pushBar(track: SequencedSound[], sounds: MacSongSounds, start: number, end: number): void {
  for (let half = 0; start + half / 2 < end; half++) {
    const beat = start + half / 2;
    track.push({ beat, buffer: sounds.hat, gain: half % 2 === 0 ? 0.8 : 0.5 });
    if (half % 2 === 0) {
      track.push({ beat, buffer: (half / 2) % 2 === 0 ? sounds.kick : sounds.snare });
    }
  }
}
