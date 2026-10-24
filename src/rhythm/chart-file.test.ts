import { describe, expect, it } from 'vite-plus/test';
import { parseChartFile, parseChartIndex, type ChartFileOptions } from './chart-file.ts';
import { sourceFromPatterns } from './test-charts.ts';

const options: ChartFileOptions = {
  scenes: { 'windows-xp': ['dialog-info'], 'mac-2000': [] },
  icons: { 'windows-xp': ['dialog-info', 'my-computer'], 'mac-2000': ['finder'] },
};

/** Deep-copies into plain JSON so a field can be broken */
function json(value: unknown): Record<string, any> {
  return JSON.parse(JSON.stringify(value));
}

function errorsOf(data: unknown, opts = options): string[] {
  const result = parseChartFile(data, opts);
  return result.ok ? [] : result.errors;
}

describe('parseChartFile', () => {
  it('a valid chart passes', () => {
    const result = parseChartFile(json(sourceFromPatterns([[0, 1.5]])), options);
    expect(result.ok).toBe(true);
  });

  it('response can be omitted or written out', () => {
    const data = json(sourceFromPatterns([[0, 1]]));
    data.phrases[0].response = [{ beat: 2, action: 'dialog-info' }];
    expect(errorsOf(data)).toEqual([]);
  });

  it("icon is optional; when present it must be one of its scene's icons", () => {
    const data = json(sourceFromPatterns([[0]]));
    data.icon = 'my-computer';
    expect(errorsOf(data)).toEqual([]);

    data.icon = 'finder';
    expect(errorsOf(data)).toEqual(['icon: scene windows-xp has no icon finder']);

    data.icon = 'My Computer';
    expect(errorsOf(data)).toEqual([
      'icon must be a string of lowercase letters, digits and hyphens',
    ]);
  });

  it('responseGapBeats is optional; when present it must be a number ≥ 0', () => {
    const data = json(sourceFromPatterns([[0], [0]], { responseGapBeats: 4 }));
    data.phrases[0].responseGapBeats = 2;
    expect(errorsOf(data)).toEqual([]);

    data.responseGapBeats = -1;
    data.phrases[1].responseGapBeats = '1';
    expect(errorsOf(data)).toEqual([
      'responseGapBeats must be a number ≥ 0',
      'phrases[1].responseGapBeats must be a number ≥ 0',
    ]);
  });

  it('reports each missing or mistyped field', () => {
    const data = json(sourceFromPatterns([[0]]));
    delete data.title;
    data.bpm = 0;
    data.beatsPerBar = 3.5;
    expect(errorsOf(data)).toEqual([
      'title must be a non-empty string',
      'bpm must be a number greater than 0',
      'beatsPerBar must be an integer greater than 0',
    ]);
  });

  it('unknown fields are errors, so typos get caught', () => {
    const data = json(sourceFromPatterns([[0]]));
    data.phrases[0].respone = [];
    data.phrases[0].call[0].actoin = 'x';
    expect(errorsOf(data)).toEqual([
      'phrases[0].respone is not a known field',
      'phrases[0].call[0].actoin is not a known field',
    ]);
  });

  it('rejects the wrong format version', () => {
    const data = json(sourceFromPatterns([[0]]));
    data.format = 2;
    expect(errorsOf(data)).toEqual(['format must be 1, got 2']);
  });

  it('reports beats past the bar, out of order or repeated, with paths', () => {
    const data = json(sourceFromPatterns([[0, 2, 2, 4]]));
    expect(errorsOf(data)).toEqual([
      'phrases[0].call[2].beat must be after the previous event',
      'phrases[0].call[3].beat must be less than beats per bar (4)',
    ]);
  });

  it('two-press actions: the next event must come after the second press, which must fit in the bar', () => {
    const refresh = {
      scenes: { 'windows-xp': ['dialog-info', 'desktop-refresh'] },
      icons: {},
    } as const;
    const data = json(sourceFromPatterns([[0]]));
    data.phrases[0].call = [
      { beat: 0, action: 'desktop-refresh' },
      { beat: 0.5, action: 'dialog-info' },
      { beat: 1, action: 'desktop-refresh' },
      { beat: 1.5, action: 'dialog-info' },
      { beat: 3.5, action: 'desktop-refresh' },
    ];
    expect(errorsOf(data, refresh)).toEqual([
      "phrases[0].call[1].beat must be after the previous event's last press (beat 0.5)",
      "phrases[0].call[3].beat must be after the previous event's last press (beat 1.5)",
      'phrases[0].call[4].beat: the last press of desktop-refresh lands on beat 4, which must be less than beats per bar (4)',
    ]);
  });

  it('unknown actions, actions the scene does not support and unknown scenes are errors', () => {
    const unknownAction = json(sourceFromPatterns([[0]]));
    unknownAction.phrases[0].call[0].action = 'refresh';
    expect(errorsOf(unknownAction)[0]).toContain(
      'phrases[0].call[0].action must be a known action',
    );

    const macChart = json(sourceFromPatterns([[0]], { scene: 'mac-2000' }));
    expect(errorsOf(macChart)).toEqual([
      'phrases[0].call[0].action: scene mac-2000 does not support action dialog-info',
    ]);

    const unknownScene = json(sourceFromPatterns([[0]], { scene: 'win98' }));
    expect(errorsOf(unknownScene)[0]).toContain('scene must be a known scene');
  });

  it('id must match the file name', () => {
    const data = json(sourceFromPatterns([[0]], { id: 'abc' }));
    expect(errorsOf(data, { ...options, expectedId: 'xyz' })).toEqual([
      'id "abc" must match the file name "xyz"',
    ]);
  });

  it('rejects non-objects and empty phrase lists', () => {
    expect(errorsOf([])).toEqual(['a chart must be a JSON object']);
    const data = json(sourceFromPatterns([]));
    expect(errorsOf(data)).toEqual(['phrases must be an array with at least one phrase']);
  });
});

describe('parseChartIndex', () => {
  it('a valid index passes', () => {
    expect(parseChartIndex({ format: 1, charts: ['a.json', 'b-2.json'] }).ok).toBe(true);
  });

  it('rejects bad or duplicate file names', () => {
    const result = parseChartIndex({ format: 1, charts: ['../x.json', 'a.json', 'a.json'] });
    expect(result.ok ? [] : result.errors).toEqual([
      'charts[0] must be a file name of lowercase letters, digits and hyphens + .json',
      'charts[2] "a.json" is listed twice',
    ]);
  });
});
