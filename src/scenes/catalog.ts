// 场景目录：每个场景的名称、支持的动作和对谱面的附加规则。
// 不依赖 PixiJS，谱面加载器和单元测试都能直接用。

import type { ActionType } from '../rhythm/actions.ts';
import type { Chart } from '../rhythm/chart.ts';
import { checkWindowsXpChart } from './windows-xp/chart-rules.ts';

export type SceneId = 'windows-xp' | 'mac-2000';

export interface SceneInfo {
  /** 给人看的名称 */
  label: string;
  /** 这个场景能演出的动作 */
  actions: readonly ActionType[];
  /** 通用校验之外的附加规则；返回错误说明 */
  checkChart?(chart: Chart): string[];
}

export const SCENE_CATALOG: Record<SceneId, SceneInfo> = {
  'windows-xp': {
    label: 'Windows XP 桌面',
    actions: ['close-window'],
    checkChart: checkWindowsXpChart,
  },
  'mac-2000': {
    label: 'Mac 桌面（水晶）',
    // 还是占位场景，没有可玩的动作
    actions: [],
  },
};

/** 每个场景支持的动作，供谱面文件校验使用 */
export function sceneActions(): Record<string, readonly ActionType[]> {
  return Object.fromEntries(Object.entries(SCENE_CATALOG).map(([id, info]) => [id, info.actions]));
}
