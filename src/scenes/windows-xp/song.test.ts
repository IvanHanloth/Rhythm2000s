import { describe, expect, it } from 'vite-plus/test';
import { buildChart } from '../../rhythm/chart.ts';
import { sourceFromPatterns } from '../../rhythm/test-charts.ts';
import { DIALOG_KINDS } from './dialog-kinds.ts';
import { buildBackingTrack, type PopupSounds } from './song.ts';
import { loadMvpChart } from './test-mvp-chart.ts';

/** 用名字代替真正的 AudioBuffer，只检查排了哪些声音 */
const sounds = {
  ...Object.fromEntries(
    ['kick', 'snare', 'hat', 'countAccent', 'count', 'close', 'miss', 'result'].map((n) => [n, n]),
  ),
  dialogs: Object.fromEntries(Object.keys(DIALOG_KINDS).map((kind) => [kind, kind])),
} as unknown as PopupSounds;

describe('MVP 谱面文件', () => {
  it('8 个乐句，每句「示范 + 1 拍空档 + 跟打」，全曲 80 拍', () => {
    const chart = loadMvpChart();
    expect(chart.phrases).toHaveLength(8);
    expect(chart.phrases[0]).toEqual({ callStart: 4, callEnd: 8, responseStart: 9, end: 13 });
    expect(chart.endBeat).toBe(4 + 8 * 9 + 4);
  });
});

describe('buildBackingTrack', () => {
  const chart = loadMvpChart();
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

  it('每个示范动作都有一声对应种类的消息框提示音', () => {
    const popups = track.filter((s) => (s.buffer as unknown as string).startsWith('dialog-'));
    expect(popups.map((s) => s.beat)).toEqual(chart.calls.map((c) => c.beat));
    expect(popups.map((s) => s.buffer)).toEqual(chart.calls.map((c) => c.action));
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

describe('空档的伴奏', () => {
  const chart = buildChart(sourceFromPatterns([[0]], { responseGapBeats: 0.5 }));
  const track = buildBackingTrack(chart, sounds);
  const names = (beat: number) =>
    track
      .filter((s) => s.beat === beat)
      .map((s) => s.buffer as unknown as string)
      .sort();

  it('示范小节和跟打小节的鼓点各自从第 1 拍开始，和跟打目标对齐', () => {
    const drums = track
      .filter((s) => ['kick', 'snare'].includes(s.buffer as unknown as string))
      .map((s) => `${s.beat}:${s.buffer as unknown as string}`);
    // 示范 4～8 拍，空档 8～8.5 拍，跟打 8.5～12.5 拍
    expect(drums).toEqual([
      '4:kick',
      '5:snare',
      '6:kick',
      '7:snare',
      '8.5:kick',
      '9.5:snare',
      '10.5:kick',
      '11.5:snare',
      '12.5:kick',
      '12.5:snare',
    ]);
  });

  it('空档里只有踩镲', () => {
    expect(names(8)).toEqual(['hat']);
  });
});
