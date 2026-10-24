// XP 场景的伴奏和音效，全部 MVP 暂定（doc/prototypes/mvp.md）。
// 谱面不在这里，存放在 public/charts/（ADR 0003）。

import type { SequencedSound } from '../../audio/sequencer.ts';
import { createBlip, createHat, createKick, createSnare } from '../../audio/synth.ts';
import type { Chart } from '../../rhythm/chart.ts';

export interface PopupSounds {
  kick: AudioBuffer;
  snare: AudioBuffer;
  hat: AudioBuffer;
  /** 预备拍的节拍器点击，重音和普通各一个 */
  countAccent: AudioBuffer;
  count: AudioBuffer;
  /** 示范段弹窗的「叮」 */
  popup: AudioBuffer;
  /** 玩家关窗的「啪」 */
  close: AudioBuffer;
  /** Miss 的错误提示音 */
  miss: AudioBuffer;
}

export function createPopupSounds(context: BaseAudioContext): PopupSounds {
  return {
    kick: createKick(context),
    snare: createSnare(context),
    hat: createHat(context),
    countAccent: createBlip(context, { from: 1760, duration: 0.05, gain: 0.5 }),
    count: createBlip(context, { from: 880, duration: 0.05, gain: 0.5 }),
    popup: createBlip(context, { from: 988, to: 1319, duration: 0.09, gain: 0.35, wave: 'square' }),
    close: createBlip(context, { from: 1200, to: 500, duration: 0.07, gain: 0.45, wave: 'square' }),
    miss: createBlip(context, { from: 160, duration: 0.22, gain: 0.35, wave: 'square' }),
  };
}

/** 伴奏：预备小节打节拍器，示范 / 跟打小节「底鼓、军鼓交替，每半拍踩镲」，空档只有踩镲，结尾只收一下；再加上示范段的弹窗声。 */
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
    track.push({ beat: call.beat, buffer: sounds.popup });
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
