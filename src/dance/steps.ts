// Dance charts (doc/dance-machine.md "Chart format"): pad keys, the eight step directions and validation of the JSON in
// public/dance/.
// No PixiJS, so the loader and unit tests can use it directly.

export const DANCE_FORMAT_VERSION = 1;

/** The pad's four arrow panels, one key each */
export const ARROWS = ['left', 'down', 'up', 'right'] as const;
export type Arrow = (typeof ARROWS)[number];

/** The eight step directions: the single arrows and the diagonals made of two adjacent arrows */
export const DIRECTIONS = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The keys each direction needs, in ARROWS order: ← and ↑ together make ↖ */
export const DIRECTION_KEYS: Readonly<Record<Direction, readonly Arrow[]>> = {
  up: ['up'],
  'up-right': ['up', 'right'],
  right: ['right'],
  'down-right': ['down', 'right'],
  down: ['down'],
  'down-left': ['left', 'down'],
  left: ['left'],
  'up-left': ['left', 'up'],
};

/** Screen angle of a direction (radians, 0 pointing right, clockwise as screen y goes down) */
export function directionAngle(direction: Direction): number {
  return ((DIRECTIONS.indexOf(direction) - 2) * Math.PI) / 4;
}

/** The direction exactly these held keys make; null for none, three or more keys, or an opposite pair */
export function directionOfKeys(keys: ReadonlySet<Arrow>): Direction | null {
  return (
    DIRECTIONS.find((direction) => {
      const needed = DIRECTION_KEYS[direction];
      return needed.length === keys.size && needed.every((key) => keys.has(key));
    }) ?? null
  );
}

/** Steps fall on quarters of a beat */
export const STEP_GRID = 0.25;
/** Foot rating range on the song list */
export const LEVEL_RANGE = { min: 1, max: 10 } as const;

export interface DanceStep {
  /** Beats from the first beat after the count-in */
  beat: number;
  direction: Direction;
}

export interface DanceChart {
  id: string;
  title: string;
  bpm: number;
  /** Foot rating, 1–10 */
  level: number;
  beatsPerBar: number;
  countInBars: number;
  outroBars: number;
  steps: readonly DanceStep[];
}

export interface DanceIndex {
  charts: readonly string[];
}

export type DanceParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHART_KEYS = [
  'format',
  'id',
  'title',
  'bpm',
  'level',
  'beatsPerBar',
  'countInBars',
  'outroBars',
  'steps',
];
const STEP_KEYS = ['beat', 'direction'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}${path ? '.' : ''}${key} is not a known field`);
}

/** Beat of the bar after the count-in where the steps start: chart beat 0 is song beat countInBars × beatsPerBar */
export function firstStepBeat(chart: DanceChart): number {
  return chart.countInBars * chart.beatsPerBar;
}

/** Song length in song beats: the count-in, every bar with a step, then the outro */
export function songBeats(chart: DanceChart): number {
  const lastStep = chart.steps.at(-1);
  if (!lastStep) throw new Error(`Dance chart ${chart.id} has no steps`);
  const bars = Math.floor(lastStep.beat / chart.beatsPerBar) + 1;
  return (chart.countInBars + bars + chart.outroBars) * chart.beatsPerBar;
}

/** Song length in seconds, for the song list */
export function songSeconds(chart: DanceChart): number {
  return (songBeats(chart) * 60) / chart.bpm;
}

/** How a step is coloured, from where it falls in the beat: whole beats, half beats, quarter beats */
export type StepNote = 'quarter' | 'eighth' | 'sixteenth';

export function stepNote(beat: number): StepNote {
  const fraction = beat - Math.floor(beat);
  if (fraction === 0) return 'quarter';
  if (fraction === 0.5) return 'eighth';
  return 'sixteenth';
}

/** Validates public/dance/index.json */
export function parseDanceIndex(data: unknown): DanceParseResult<DanceIndex> {
  if (!isRecord(data)) return { ok: false, errors: ['the index must be an object'] };
  const errors = unknownKeys(data, ['format', 'charts'], '');
  if (data.format !== DANCE_FORMAT_VERSION) errors.push(`format must be ${DANCE_FORMAT_VERSION}`);
  const charts = data.charts;
  if (!Array.isArray(charts) || charts.some((file) => typeof file !== 'string')) {
    errors.push('charts must be a list of file names');
  } else if (new Set(charts).size !== charts.length) {
    errors.push('charts lists a file twice');
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { charts: charts as string[] } };
}

/** Validates one dance chart file; `expectedId` comes from the file name */
export function parseDanceChart(data: unknown, expectedId?: string): DanceParseResult<DanceChart> {
  if (!isRecord(data)) return { ok: false, errors: ['the chart must be an object'] };
  const errors = unknownKeys(data, CHART_KEYS, '');

  if (data.format !== DANCE_FORMAT_VERSION) errors.push(`format must be ${DANCE_FORMAT_VERSION}`);
  const { id, title, bpm, level, beatsPerBar, countInBars, outroBars } = data;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    errors.push('id must be lowercase letters, digits and hyphens');
  } else if (expectedId !== undefined && id !== expectedId) {
    errors.push(`id must match the file name (${expectedId})`);
  }
  if (typeof title !== 'string' || title.trim() === '')
    errors.push('title must be a non-empty string');
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0)
    errors.push('bpm must be a number above 0');
  if (!isInteger(level, LEVEL_RANGE.min) || level > LEVEL_RANGE.max)
    errors.push(`level must be a whole number from ${LEVEL_RANGE.min} to ${LEVEL_RANGE.max}`);
  if (!isInteger(beatsPerBar, 1)) errors.push('beatsPerBar must be a whole number above 0');
  if (!isInteger(countInBars, 0)) errors.push('countInBars must be a whole number, 0 or more');
  if (!isInteger(outroBars, 0)) errors.push('outroBars must be a whole number, 0 or more');

  const steps: DanceStep[] = [];
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push('steps must be a list with at least one step');
  } else {
    data.steps.forEach((raw: unknown, i) => {
      const path = `steps[${i}]`;
      if (!isRecord(raw)) {
        errors.push(`${path} must be an object`);
        return;
      }
      errors.push(...unknownKeys(raw, STEP_KEYS, path));
      const step = parseStep(raw, path, errors);
      if (!step) return;
      const previous = steps.at(-1);
      if (previous && step.beat <= previous.beat)
        errors.push(`${path}.beat must be greater than the previous step's beat`);
      steps.push(step);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: id as string,
      title: (title as string).trim(),
      bpm: bpm as number,
      level: level as number,
      beatsPerBar: beatsPerBar as number,
      countInBars: countInBars as number,
      outroBars: outroBars as number,
      steps,
    },
  };
}

function parseStep(raw: Record<string, unknown>, path: string, errors: string[]): DanceStep | null {
  const { beat, direction } = raw;
  let ok = true;
  if (typeof beat !== 'number' || !Number.isFinite(beat) || beat < 0) {
    errors.push(`${path}.beat must be a number, 0 or more`);
    ok = false;
  } else if (!Number.isInteger(beat / STEP_GRID)) {
    errors.push(`${path}.beat must fall on a quarter beat (0, 0.25, 0.5, 0.75…)`);
    ok = false;
  }
  const known = isDirection(direction);
  if (!known) errors.push(`${path}.direction must be one of ${DIRECTIONS.join(', ')}`);
  if (!ok || !known) return null;
  return { beat: beat as number, direction };
}
