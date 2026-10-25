import { describe, expect, it } from 'vite-plus/test';
import {
  DIRECTIONS,
  DIRECTION_KEYS,
  directionAngle,
  directionOfKeys,
  parseDanceChart,
  parseDanceIndex,
  songBeats,
  stepNote,
  type Arrow,
} from './steps.ts';

const valid = {
  format: 1,
  id: 'dance-test',
  title: 'Test',
  bpm: 120,
  level: 3,
  beatsPerBar: 4,
  countInBars: 1,
  outroBars: 1,
  steps: [
    { beat: 0, direction: 'left' },
    { beat: 1.5, direction: 'up-left' },
    { beat: 5, direction: 'down-right' },
  ],
};

describe('parseDanceChart', () => {
  it('accepts a valid chart', () => {
    const result = parseDanceChart(valid, 'dance-test');
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.steps.map((s) => s.direction)).toEqual(['left', 'up-left', 'down-right']);
  });

  it.each([
    [{ steps: [{ beat: 0, direction: 'left-right' }] }, 'steps[0].direction must be one of'],
    [{ steps: [{ beat: 0, arrows: ['left'] }] }, 'steps[0].arrows is not a known field'],
    [{ steps: [{ beat: 0.3, direction: 'up' }] }, 'steps[0].beat must fall on a quarter beat'],
    [
      {
        steps: [
          { beat: 1, direction: 'up' },
          { beat: 1, direction: 'down' },
        ],
      },
      "steps[1].beat must be greater than the previous step's beat",
    ],
    [{ steps: [] }, 'steps must be a list with at least one step'],
    [{ level: 11 }, 'level must be a whole number from 1 to 10'],
    [{ speed: 2 }, 'speed is not a known field'],
    [{ id: 'other' }, 'id must match the file name (dance-test)'],
  ])('rejects %j', (change, error) => {
    const result = parseDanceChart({ ...valid, ...change }, 'dance-test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.startsWith(error))).toBe(true);
  });
});

describe('parseDanceIndex', () => {
  it('rejects a file listed twice', () => {
    expect(parseDanceIndex({ format: 1, charts: ['a.json', 'a.json'] }).ok).toBe(false);
  });
});

describe('directions', () => {
  it('a diagonal is two adjacent keys; a single arrow is its own key', () => {
    expect(DIRECTION_KEYS['up-left']).toEqual(['left', 'up']);
    expect(DIRECTION_KEYS['down-right']).toEqual(['down', 'right']);
    expect(DIRECTION_KEYS.up).toEqual(['up']);
  });

  it('held keys light exactly one direction, never an opposite pair or three keys', () => {
    const held = (...keys: Arrow[]) => directionOfKeys(new Set(keys));
    expect(held('up', 'left')).toBe('up-left');
    expect(held('right')).toBe('right');
    expect(held('left', 'right')).toBeNull();
    expect(held('up', 'down')).toBeNull();
    expect(held('left', 'up', 'right')).toBeNull();
    expect(held()).toBeNull();
  });

  it('places directions round the ring like the pad', () => {
    expect(directionAngle('right')).toBeCloseTo(0);
    expect(directionAngle('down')).toBeCloseTo(Math.PI / 2);
    expect(directionAngle('up')).toBeCloseTo(-Math.PI / 2);
    expect(directionAngle('up-left')).toBeCloseTo((5 * Math.PI) / 4);
    expect(new Set(DIRECTIONS.map(directionAngle)).size).toBe(8);
  });
});

describe('song length and colours', () => {
  it('counts the count-in, every bar with a step and the outro', () => {
    const result = parseDanceChart(valid);
    if (!result.ok) throw new Error(result.errors.join('; '));
    // Count-in bar, steps in bars 1–2, outro bar
    expect(songBeats(result.value)).toBe(16);
  });

  it('colours steps by where they fall in the beat', () => {
    expect([0, 2.5, 3.25, 3.75].map(stepNote)).toEqual([
      'quarter',
      'eighth',
      'sixteenth',
      'sixteenth',
    ]);
  });
});
