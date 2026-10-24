import { describe, expect, it } from 'vite-plus/test';
import { buildBackingTrack, buildPopupChart, type PopupSounds } from './song.ts';

/** 用名字代替真正的 AudioBuffer，只检查排了哪些声音 */
const sounds = Object.fromEntries(
  ['kick', 'snare', 'hat', 'countAccent', 'count', 'popup', 'close', 'miss'].map((name) => [
    name,
    name,
  ]),
) as unknown as PopupSounds;

describe('buildPopupChart', () => {
  it('8 个乐句，全曲 1 + 16 + 1 小节', () => {
    const chart = buildPopupChart();
    expect(chart.phrases).toHaveLength(8);
    expect(chart.endBeat).toBe(18 * 4);
  });
});

describe('buildBackingTrack', () => {
  const chart = buildPopupChart();
  const track = buildBackingTrack(chart, sounds);
  const at = (beat: number) =>
    track
      .filter((s) => s.beat === beat)
      .map((s) => s.buffer as unknown as string)
      .sort();

  it('预备小节是节拍器点击，第 1 拍是重音', () => {
    expect(at(0)).toEqual(['countAccent', 'hat']);
    expect(at(1)).toEqual(['count', 'hat']);
  });

  it('每个示范动作都有一声弹窗音', () => {
    const popups = track.filter((s) => (s.buffer as unknown as string) === 'popup');
    expect(popups.map((s) => s.beat)).toEqual(chart.calls.map((c) => c.beat));
  });

  it('跟打段不提示动作，只有鼓点', () => {
    const response = chart.responses[0]!.beat;
    expect(at(response)).toEqual(['hat', 'kick']);
  });

  it('最后一小节只收一下，之后没有声音', () => {
    const lastBar = chart.endBeat - 4;
    expect(at(lastBar)).toEqual(['kick', 'snare']);
    expect(track.every((s) => s.beat <= lastBar)).toBe(true);
  });
});
