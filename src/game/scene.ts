// 场景接口：Windows XP 桌面、Mac 桌面等主题小游戏都是一个场景（ADR 0002）。

import type { Container } from 'pixi.js';

/** 每帧传给场景的信息。 */
export interface FrameInfo {
  /** 此刻扬声器正在播放的音频时间（秒，AudioContext 时间轴）。画面只根据它计算，不累加帧间隔。 */
  audioTime: number;
}

export interface Scene {
  /** 场景的全部画面，按 1280×720 的逻辑坐标绘制 */
  readonly view: Container;
  /** 每帧调用一次 */
  update(frame: FrameInfo): void;
  /** 离开场景时调用，释放画面和其他资源 */
  destroy(): void;
}

export interface SceneEntry {
  /** 场景标识，例如 "windows-xp" */
  id: string;
  /** 给人看的名称，例如「Windows XP 桌面」 */
  label: string;
  create(): Scene;
}
