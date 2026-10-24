// XP 场景里点在任务栏、桌面、程序窗口上的四个动作（doc/scenes/windows-xp-levels.md）：
// 托盘气泡、程序窗口最小化、开始菜单、回收站。不依赖 PixiJS，谱面校验和单元测试都能直接用。

import type { ActionType } from '../../rhythm/actions.ts';
import type { XpSoundName } from './assets.ts';

export type ShellAction = Extract<
  ActionType,
  'balloon-info' | 'window-minimize' | 'start-menu' | 'recycle-bin'
>;

export interface ShellActionInfo {
  /** 示范段在拍点上响的声音；start-menu 的两下是点击声，不在这里（见 song.ts clickSound） */
  appear: XpSoundName | null;
  /** 跟打段命中时的声音 */
  handled: XpSoundName;
}

export const SHELL_ACTIONS: Record<ShellAction, ShellActionInfo> = {
  'balloon-info': { appear: 'balloon', handled: 'navigate' },
  'window-minimize': { appear: 'restore', handled: 'minimize' },
  'start-menu': { appear: null, handled: 'menuCommand' },
  'recycle-bin': { appear: 'fileDrop', handled: 'recycle' },
};

export function isShellAction(action: string): action is ShellAction {
  return Object.hasOwn(SHELL_ACTIONS, action);
}

/** 每个乐句的上限：画面上的位置就这么多（doc/scenes/windows-xp-levels.md「每个乐句的上限」） */
export const PHRASE_LIMITS = {
  /** 消息框 + 程序窗口共用屏幕上的 6 个位置 */
  windows: 6,
  /** 任务栏上除「我的关卡」外只放得下 4 个程序按钮 */
  programs: 4,
  /** 托盘里只有 3 个图标可以指 */
  balloons: 3,
  /** 桌面那一行只摆得下 6 个文件 */
  files: 6,
} as const;
