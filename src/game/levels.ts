// 关卡：一首谱面就是一关。按场景登记的顺序、谱面清单（public/charts/index.json）的顺序排好，
// 网吧里一台关卡电脑对应一关（doc/hub.md）。网址 #场景/谱面 直接打开某一关。
// 不依赖 DOM，单元测试可以直接用。

import { ACTION_LABELS } from '../rhythm/actions.ts';
import type { Chart } from '../rhythm/chart.ts';
import type { JudgementCounts } from './records.ts';
import { RATING_LABELS, ratingFor } from './round-summary.ts';

export interface Level {
  /** 谱面 id */
  id: string;
  sceneId: string;
  sceneLabel: string;
  /** 在所属场景里是第几关（从 1 开始） */
  number: number;
  title: string;
  bpm: number;
  /** 谱面用到的部件，按第一次出现的顺序，例如「错误消息框、警告消息框」 */
  actions: string;
}

export function buildLevels(
  scenes: readonly { id: string; label: string }[],
  charts: readonly Chart[],
): Level[] {
  return scenes.flatMap((scene) =>
    charts
      .filter((chart) => chart.scene === scene.id)
      .map((chart, i) => ({
        id: chart.id,
        sceneId: scene.id,
        sceneLabel: scene.label,
        number: i + 1,
        title: chart.title,
        bpm: chart.bpm,
        actions: [...new Set(chart.calls.map((call) => ACTION_LABELS[call.action]))].join('、'),
      })),
  );
}

/** 列表里的下一关；已经是最后一关时返回 null */
export function nextLevel(levels: readonly Level[], id: string): Level | null {
  const index = levels.findIndex((level) => level.id === id);
  return index >= 0 ? (levels[index + 1] ?? null) : null;
}

export type Route = { kind: 'hub' } | { kind: 'scene'; sceneId: string; chartId?: string };

/**
 * 解析网址里 # 后面的部分：空的或认不出来的都回到街区；
 * `场景` 打开场景（场景自己挑谱面），`场景/谱面` 打开某一关。
 */
export function parseRoute(hash: string, sceneIds: readonly string[]): Route {
  const [sceneId, chartId] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
  if (!sceneId || !sceneIds.includes(sceneId)) return { kind: 'hub' };
  return chartId ? { kind: 'scene', sceneId, chartId } : { kind: 'scene', sceneId };
}

export function levelRoute(level: Level): string {
  return `${level.sceneId}/${level.id}`;
}

/** 最佳成绩的一行文字，例如「Perfect 12 · Good 3 · Miss 1（优秀）」 */
export function formatRecord(counts: JudgementCounts): string {
  const total = counts.perfect + counts.good + counts.miss;
  const rating =
    total === 0
      ? ''
      : `（${RATING_LABELS[ratingFor((counts.perfect + counts.good * 0.5) / total)]}）`;
  return `Perfect ${counts.perfect} · Good ${counts.good} · Miss ${counts.miss}${rating}`;
}
