// Validates chart files (JSON): turns downloaded unknown data into a ChartSource.
// Format: doc/chart-format.md. Errors carry field paths and are all listed at once.

import { ACTION_TYPES, isActionType, lastTapOffset, type ActionType } from './actions.ts';

export const CHART_FORMAT_VERSION = 1;

export interface ChartEventSource {
  /** Beat position from the start of its bar */
  beat: number;
  action: ActionType;
}

export interface ChartPhraseSource {
  call: ChartEventSource[];
  /** Same as call when omitted */
  response?: ChartEventSource[];
  /** Gap in beats between call and response for this phrase; falls back to the chart's value */
  responseGapBeats?: number;
}

export interface ChartSource {
  format: typeof CHART_FORMAT_VERSION;
  id: string;
  title: string;
  /** The level icon, one of the scene's icon IDs; picked from the actions when omitted */
  icon?: string;
  scene: string;
  bpm: number;
  beatsPerBar: number;
  countInBars: number;
  outroBars: number;
  /** Gap in beats after the call bar and before the response bar; DEFAULT_RESPONSE_GAP_BEATS (0) when omitted */
  responseGapBeats?: number;
  phrases: ChartPhraseSource[];
}

export interface ChartFileOptions {
  /** Actions each scene supports, keyed by scene id */
  scenes: Readonly<Record<string, readonly ActionType[]>>;
  /** System icon IDs each scene has, keyed by scene id (doc/chart-format.md "Icon IDs") */
  icons: Readonly<Record<string, readonly string[]>>;
  /** Chart id derived from the file name; when given, the id field must match */
  expectedId?: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHART_KEYS = [
  'format',
  'id',
  'title',
  'icon',
  'scene',
  'bpm',
  'beatsPerBar',
  'countInBars',
  'outroBars',
  'responseGapBeats',
  'phrases',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Optional gap: absent, or a finite number ≥ 0 */
function isOptionalGap(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isInteger(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}${path ? '.' : ''}${key} is not a known field`);
}

export function parseChartFile(data: unknown, options: ChartFileOptions): ParseResult<ChartSource> {
  if (!isRecord(data)) return { ok: false, errors: ['a chart must be a JSON object'] };
  const errors = unknownKeys(data, CHART_KEYS, '');

  if (data.format !== CHART_FORMAT_VERSION) {
    errors.push(`format must be ${CHART_FORMAT_VERSION}, got ${JSON.stringify(data.format)}`);
  }
  if (typeof data.id !== 'string' || !ID_PATTERN.test(data.id)) {
    errors.push('id must be a string of lowercase letters, digits and hyphens');
  } else if (options.expectedId !== undefined && data.id !== options.expectedId) {
    errors.push(`id "${data.id}" must match the file name "${options.expectedId}"`);
  }
  if (typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('title must be a non-empty string');
  }

  const sceneActions =
    typeof data.scene === 'string' && Object.hasOwn(options.scenes, data.scene)
      ? options.scenes[data.scene]!
      : null;
  if (!sceneActions) {
    const known = Object.keys(options.scenes).join(', ');
    errors.push(`scene must be a known scene (${known}), got ${JSON.stringify(data.scene)}`);
  }
  if (data.icon !== undefined) {
    const icons =
      typeof data.scene === 'string' && Object.hasOwn(options.icons, data.scene)
        ? options.icons[data.scene]!
        : null;
    if (typeof data.icon !== 'string' || !ID_PATTERN.test(data.icon)) {
      errors.push('icon must be a string of lowercase letters, digits and hyphens');
    } else if (icons && !icons.includes(data.icon)) {
      errors.push(`icon: scene ${String(data.scene)} has no icon ${data.icon}`);
    }
  }

  if (typeof data.bpm !== 'number' || !(data.bpm > 0) || !Number.isFinite(data.bpm)) {
    errors.push('bpm must be a number greater than 0');
  }
  const beatsPerBar = isInteger(data.beatsPerBar, 1) ? data.beatsPerBar : null;
  if (beatsPerBar === null) errors.push('beatsPerBar must be an integer greater than 0');
  if (!isInteger(data.countInBars, 0)) errors.push('countInBars must be an integer ≥ 0');
  if (!isInteger(data.outroBars, 0)) errors.push('outroBars must be an integer ≥ 0');
  if (!isOptionalGap(data.responseGapBeats)) {
    errors.push('responseGapBeats must be a number ≥ 0');
  }

  if (!Array.isArray(data.phrases) || data.phrases.length === 0) {
    errors.push('phrases must be an array with at least one phrase');
  } else {
    data.phrases.forEach((phrase, i) => {
      const path = `phrases[${i}]`;
      if (!isRecord(phrase)) {
        errors.push(`${path} must be an object`);
        return;
      }
      errors.push(...unknownKeys(phrase, ['call', 'response', 'responseGapBeats'], path));
      if (!isOptionalGap(phrase.responseGapBeats)) {
        errors.push(`${path}.responseGapBeats must be a number ≥ 0`);
      }
      errors.push(
        ...checkEvents(phrase.call, `${path}.call`, beatsPerBar, sceneActions, data.scene),
      );
      if (phrase.response !== undefined) {
        errors.push(
          ...checkEvents(
            phrase.response,
            `${path}.response`,
            beatsPerBar,
            sceneActions,
            data.scene,
          ),
        );
      }
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: data as unknown as ChartSource };
}

function checkEvents(
  events: unknown,
  path: string,
  beatsPerBar: number | null,
  sceneActions: readonly ActionType[] | null,
  scene: unknown,
): string[] {
  if (!Array.isArray(events) || events.length === 0) {
    return [`${path} must be an array with at least one event`];
  }
  const errors: string[] = [];
  let previousBeat = -Infinity;
  /** Beat of the previous event's last press (two-press actions end on the second press) */
  let previousEnd = -Infinity;

  events.forEach((event, j) => {
    const eventPath = `${path}[${j}]`;
    if (!isRecord(event)) {
      errors.push(`${eventPath} must be an object`);
      return;
    }
    errors.push(...unknownKeys(event, ['beat', 'action'], eventPath));

    const { beat, action } = event;
    const last = isActionType(action) ? lastTapOffset(action) : 0;
    if (typeof beat !== 'number' || !Number.isFinite(beat) || beat < 0) {
      errors.push(`${eventPath}.beat must be a number ≥ 0`);
    } else {
      if (beatsPerBar !== null && beat >= beatsPerBar) {
        errors.push(`${eventPath}.beat must be less than beats per bar (${beatsPerBar})`);
      } else if (beatsPerBar !== null && beat + last >= beatsPerBar) {
        errors.push(
          `${eventPath}.beat: the last press of ${String(action)} lands on beat ${beat + last}, which must be less than beats per bar (${beatsPerBar})`,
        );
      }
      if (beat <= previousBeat) {
        errors.push(`${eventPath}.beat must be after the previous event`);
      } else if (beat <= previousEnd) {
        errors.push(
          `${eventPath}.beat must be after the previous event's last press (beat ${previousEnd})`,
        );
      }
      previousBeat = beat;
      previousEnd = beat + last;
    }

    if (!isActionType(action)) {
      errors.push(
        `${eventPath}.action must be a known action (${ACTION_TYPES.join(', ')}), got ${JSON.stringify(action)}`,
      );
    } else if (sceneActions && !sceneActions.includes(action)) {
      errors.push(`${eventPath}.action: scene ${String(scene)} does not support action ${action}`);
    }
  });
  return errors;
}

export interface ChartIndex {
  format: typeof CHART_FORMAT_VERSION;
  /** Chart file names, e.g. "xp-first-boot.json" */
  charts: string[];
}

const FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Validates the chart index (index.json) */
export function parseChartIndex(data: unknown): ParseResult<ChartIndex> {
  if (!isRecord(data)) return { ok: false, errors: ['the chart index must be a JSON object'] };
  const errors = unknownKeys(data, ['format', 'charts'], '');
  if (data.format !== CHART_FORMAT_VERSION) {
    errors.push(`format must be ${CHART_FORMAT_VERSION}, got ${JSON.stringify(data.format)}`);
  }
  if (!Array.isArray(data.charts)) {
    errors.push('charts must be an array of file names');
  } else {
    const seen = new Set<unknown>();
    data.charts.forEach((file, i) => {
      if (typeof file !== 'string' || !FILE_PATTERN.test(file)) {
        errors.push(
          `charts[${i}] must be a file name of lowercase letters, digits and hyphens + .json`,
        );
      } else if (seen.has(file)) {
        errors.push(`charts[${i}] "${file}" is listed twice`);
      }
      seen.add(file);
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: data as unknown as ChartIndex };
}
