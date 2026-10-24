// 谱面文件（JSON）的校验：把下载来的未知数据检查成 ChartSource。
// 格式说明见 doc/chart-format.md。报错带字段路径，一次列出所有问题。

import { ACTION_TYPES, isActionType, lastTapOffset, type ActionType } from './actions.ts';

export const CHART_FORMAT_VERSION = 1;

export interface ChartEventSource {
  /** 相对所在小节开头的拍位置 */
  beat: number;
  action: ActionType;
}

export interface ChartPhraseSource {
  call: ChartEventSource[];
  /** 不写时与 call 相同 */
  response?: ChartEventSource[];
  /** 这个乐句示范与跟打之间空几拍；不写时用谱面顶层的值 */
  responseGapBeats?: number;
}

export interface ChartSource {
  format: typeof CHART_FORMAT_VERSION;
  id: string;
  title: string;
  scene: string;
  bpm: number;
  beatsPerBar: number;
  countInBars: number;
  outroBars: number;
  /** 示范小节结束后、跟打小节开始前空几拍；不写时用 DEFAULT_RESPONSE_GAP_BEATS（0 拍） */
  responseGapBeats?: number;
  phrases: ChartPhraseSource[];
}

export interface ChartFileOptions {
  /** 每个场景支持的动作，键是场景 id */
  scenes: Readonly<Record<string, readonly ActionType[]>>;
  /** 文件名推出的谱面 id；给出时要求与 id 字段一致 */
  expectedId?: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHART_KEYS = [
  'format',
  'id',
  'title',
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

/** 可选的空档拍数：不写，或不小于 0 的有限数字 */
function isOptionalGap(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isInteger(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${path}${path ? '.' : ''}${key} 是未定义的字段`);
}

export function parseChartFile(data: unknown, options: ChartFileOptions): ParseResult<ChartSource> {
  if (!isRecord(data)) return { ok: false, errors: ['谱面必须是一个 JSON 对象'] };
  const errors = unknownKeys(data, CHART_KEYS, '');

  if (data.format !== CHART_FORMAT_VERSION) {
    errors.push(`format 必须是 ${CHART_FORMAT_VERSION}，收到 ${JSON.stringify(data.format)}`);
  }
  if (typeof data.id !== 'string' || !ID_PATTERN.test(data.id)) {
    errors.push('id 必须是由小写字母、数字和连字符组成的字符串');
  } else if (options.expectedId !== undefined && data.id !== options.expectedId) {
    errors.push(`id「${data.id}」必须与文件名「${options.expectedId}」一致`);
  }
  if (typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('title 必须是非空字符串');
  }

  const sceneActions =
    typeof data.scene === 'string' && Object.hasOwn(options.scenes, data.scene)
      ? options.scenes[data.scene]!
      : null;
  if (!sceneActions) {
    const known = Object.keys(options.scenes).join('、');
    errors.push(`scene 必须是已有场景之一（${known}），收到 ${JSON.stringify(data.scene)}`);
  }

  if (typeof data.bpm !== 'number' || !(data.bpm > 0) || !Number.isFinite(data.bpm)) {
    errors.push('bpm 必须是大于 0 的数字');
  }
  const beatsPerBar = isInteger(data.beatsPerBar, 1) ? data.beatsPerBar : null;
  if (beatsPerBar === null) errors.push('beatsPerBar 必须是大于 0 的整数');
  if (!isInteger(data.countInBars, 0)) errors.push('countInBars 必须是不小于 0 的整数');
  if (!isInteger(data.outroBars, 0)) errors.push('outroBars 必须是不小于 0 的整数');
  if (!isOptionalGap(data.responseGapBeats)) {
    errors.push('responseGapBeats 必须是不小于 0 的数字');
  }

  if (!Array.isArray(data.phrases) || data.phrases.length === 0) {
    errors.push('phrases 必须是至少有一个乐句的数组');
  } else {
    data.phrases.forEach((phrase, i) => {
      const path = `phrases[${i}]`;
      if (!isRecord(phrase)) {
        errors.push(`${path} 必须是对象`);
        return;
      }
      errors.push(...unknownKeys(phrase, ['call', 'response', 'responseGapBeats'], path));
      if (!isOptionalGap(phrase.responseGapBeats)) {
        errors.push(`${path}.responseGapBeats 必须是不小于 0 的数字`);
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
    return [`${path} 必须是至少有一个事件的数组`];
  }
  const errors: string[] = [];
  let previousBeat = -Infinity;
  /** 上一个事件最后一下的拍位置（要按两下的动作占到第二下） */
  let previousEnd = -Infinity;

  events.forEach((event, j) => {
    const eventPath = `${path}[${j}]`;
    if (!isRecord(event)) {
      errors.push(`${eventPath} 必须是对象`);
      return;
    }
    errors.push(...unknownKeys(event, ['beat', 'action'], eventPath));

    const { beat, action } = event;
    const last = isActionType(action) ? lastTapOffset(action) : 0;
    if (typeof beat !== 'number' || !Number.isFinite(beat) || beat < 0) {
      errors.push(`${eventPath}.beat 必须是不小于 0 的数字`);
    } else {
      if (beatsPerBar !== null && beat >= beatsPerBar) {
        errors.push(`${eventPath}.beat 必须小于每小节拍数 ${beatsPerBar}`);
      } else if (beatsPerBar !== null && beat + last >= beatsPerBar) {
        errors.push(
          `${eventPath}.beat：${String(action)} 的最后一下在第 ${beat + last} 拍，必须小于每小节拍数 ${beatsPerBar}`,
        );
      }
      if (beat <= previousBeat) {
        errors.push(`${eventPath}.beat 必须大于上一个事件的拍位置`);
      } else if (beat <= previousEnd) {
        errors.push(`${eventPath}.beat 必须在上一个事件的最后一下（第 ${previousEnd} 拍）之后`);
      }
      previousBeat = beat;
      previousEnd = beat + last;
    }

    if (!isActionType(action)) {
      errors.push(
        `${eventPath}.action 必须是已有动作之一（${ACTION_TYPES.join('、')}），收到 ${JSON.stringify(action)}`,
      );
    } else if (sceneActions && !sceneActions.includes(action)) {
      errors.push(`${eventPath}.action：场景 ${String(scene)} 不支持动作 ${action}`);
    }
  });
  return errors;
}

export interface ChartIndex {
  format: typeof CHART_FORMAT_VERSION;
  /** 谱面文件名，如 "xp-popup-mvp.json" */
  charts: string[];
}

const FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** 校验谱面清单 index.json */
export function parseChartIndex(data: unknown): ParseResult<ChartIndex> {
  if (!isRecord(data)) return { ok: false, errors: ['谱面清单必须是一个 JSON 对象'] };
  const errors = unknownKeys(data, ['format', 'charts'], '');
  if (data.format !== CHART_FORMAT_VERSION) {
    errors.push(`format 必须是 ${CHART_FORMAT_VERSION}，收到 ${JSON.stringify(data.format)}`);
  }
  if (!Array.isArray(data.charts)) {
    errors.push('charts 必须是文件名数组');
  } else {
    const seen = new Set<unknown>();
    data.charts.forEach((file, i) => {
      if (typeof file !== 'string' || !FILE_PATTERN.test(file)) {
        errors.push(`charts[${i}] 必须是「小写字母、数字、连字符 + .json」的文件名`);
      } else if (seen.has(file)) {
        errors.push(`charts[${i}]「${file}」重复`);
      }
      seen.add(file);
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: data as unknown as ChartIndex };
}
