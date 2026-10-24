// 谱面加载：运行时下载 public/charts/ 下的清单和谱面文件，逐个校验（ADR 0003）。
// 出错的谱面跳过，不影响其他谱面；错误收集起来交给调用方显示。

import { buildChart, type Chart } from '../rhythm/chart.ts';
import { parseChartFile, parseChartIndex } from '../rhythm/chart-file.ts';
import { MVP_WINDOWS } from '../rhythm/judge.ts';
import { checkTurnCueSpacing } from '../rhythm/turn-cue.ts';
import { sceneActions, SCENE_CATALOG, type SceneId } from '../scenes/catalog.ts';

export const CHART_INDEX_FILE = 'index.json';

/** 下载 charts/ 目录下的一个文件并解析成 JSON；失败时抛出错误 */
export type FetchChartJson = (file: string) => Promise<unknown>;

export interface ChartLoadResult {
  charts: Chart[];
  /** 每条一行，已带上文件名 */
  errors: string[];
}

export async function loadCharts(fetchJson: FetchChartJson): Promise<ChartLoadResult> {
  const errors: string[] = [];

  let indexData: unknown;
  try {
    indexData = await fetchJson(CHART_INDEX_FILE);
  } catch (error) {
    return { charts: [], errors: [`谱面清单 ${CHART_INDEX_FILE}：${describe(error)}`] };
  }
  const index = parseChartIndex(indexData);
  if (!index.ok) {
    return { charts: [], errors: index.errors.map((e) => `谱面清单 ${CHART_INDEX_FILE}：${e}`) };
  }

  // 同时下载，按清单顺序整理结果
  const results = await Promise.all(
    index.value.charts.map(async (file) => {
      try {
        return { file, data: await fetchJson(file) };
      } catch (error) {
        return { file, error: describe(error) };
      }
    }),
  );

  const charts: Chart[] = [];
  for (const result of results) {
    const prefix = `谱面 ${result.file}：`;
    if ('error' in result) {
      errors.push(prefix + result.error);
      continue;
    }
    const problems = checkChartData(result.data, result.file.replace(/\.json$/, ''));
    if (problems.chart) {
      charts.push(problems.chart);
    } else {
      errors.push(...problems.errors.map((e) => prefix + e));
    }
  }
  return { charts, errors };
}

/** 校验一份谱面数据：格式、场景附加规则、轮次提示的时间限制。 */
export function checkChartData(
  data: unknown,
  expectedId?: string,
): { chart: Chart; errors: [] } | { chart: null; errors: string[] } {
  const parsed = parseChartFile(data, { scenes: sceneActions(), expectedId });
  if (!parsed.ok) return { chart: null, errors: parsed.errors };

  const chart = buildChart(parsed.value);
  const scene = SCENE_CATALOG[chart.scene as SceneId];
  const errors = [
    ...(scene.checkChart?.(chart) ?? []),
    ...checkTurnCueSpacing(chart, MVP_WINDOWS.good),
  ];
  return errors.length > 0 ? { chart: null, errors } : { chart, errors: [] };
}

function describe(error: unknown): string {
  if (error instanceof SyntaxError) return `不是有效的 JSON（${error.message}）`;
  return error instanceof Error ? error.message : String(error);
}

/** 浏览器里用的下载函数：从站点的 charts/ 目录取文件，不使用缓存，改了谱面刷新即生效 */
export function fetchChartFromSite(baseUrl: string): FetchChartJson {
  return async (file) => {
    const response = await fetch(`${baseUrl}charts/${file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
    return response.json();
  };
}
