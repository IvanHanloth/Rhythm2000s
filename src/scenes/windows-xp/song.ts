// MVP 曲目：谱面、鼓点和音效，全部 MVP 暂定（doc/prototypes/mvp.md）。

import type { SequencedSound } from '../../audio/sequencer.ts';
import { createBlip, createHat, createKick, createSnare } from '../../audio/synth.ts';
import { buildCallResponseChart, type Chart } from '../../rhythm/chart.ts';

export function buildPopupChart(): Chart {
  return buildCallResponseChart({
    bpm: 120,
    beatsPerBar: 4,
    countInBars: 1,
    outroBars: 1,
    patterns: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2, 3],
      [0, 0.5, 1, 2],
      [0, 1, 1.5, 2],
      [0, 1, 2, 2.5, 3],
      [0, 0.5, 1, 1.5, 2],
      [0, 0.5, 1, 2, 3],
    ],
  });
}

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

/** 伴奏：预备小节打节拍器，正文每小节「底鼓 1、3 拍，军鼓 2、4 拍，每半拍踩镲」，最后一小节只收一下；再加上示范段的弹窗声。 */
export function buildBackingTrack(chart: Chart, sounds: PopupSounds): SequencedSound[] {
  const { beatsPerBar } = chart;
  const track: SequencedSound[] = [];
  const firstBodyBeat = chart.phrases[0]?.callStart ?? beatsPerBar;
  const lastBodyBeat = chart.phrases.at(-1)?.end ?? firstBodyBeat;

  for (let bar = 0; bar * beatsPerBar < chart.endBeat; bar++) {
    const barStart = bar * beatsPerBar;
    if (barStart < firstBodyBeat) {
      for (let i = 0; i < beatsPerBar; i++) {
        track.push({ beat: barStart + i, buffer: i === 0 ? sounds.countAccent : sounds.count });
      }
      for (let i = 0; i < beatsPerBar * 2; i++) {
        track.push({ beat: barStart + i / 2, buffer: sounds.hat, gain: 0.6 });
      }
    } else if (barStart < lastBodyBeat) {
      for (let i = 0; i < beatsPerBar; i++) {
        track.push({ beat: barStart + i, buffer: i % 2 === 0 ? sounds.kick : sounds.snare });
      }
      for (let i = 0; i < beatsPerBar * 2; i++) {
        track.push({ beat: barStart + i / 2, buffer: sounds.hat, gain: i % 2 === 0 ? 0.8 : 0.5 });
      }
    } else if (barStart === lastBodyBeat) {
      track.push({ beat: barStart, buffer: sounds.kick }, { beat: barStart, buffer: sounds.snare });
    }
  }

  for (const call of chart.calls) {
    track.push({ beat: call.beat, buffer: sounds.popup });
  }
  return track;
}
