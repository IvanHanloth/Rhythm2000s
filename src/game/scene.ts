// 场景接口：Windows XP 桌面、Mac 桌面等主题小游戏都是一个场景（ADR 0002）。

import type { Container } from 'pixi.js';
import type { AudioClock } from '../audio/audio-clock.ts';
import type { Chart } from '../rhythm/chart.ts';
import type { SceneId } from '../scenes/catalog.ts';

/** 每帧传给场景的信息。 */
export interface FrameInfo {
  /** 此刻扬声器正在播放的音频时间（秒，AudioContext 时间轴）。画面只根据它计算，不累加帧间隔。 */
  audioTime: number;
}

/** 玩家的一次动作输入（按空格或点击画面），或一次松开。 */
export interface TapInfo {
  /** 输入那一刻扬声器正在播放的音频时间（秒）。还没有扣除玩家校准值。 */
  audioTime: number;
}

/** 场景创建时拿到的共享资源。 */
export interface SceneContext {
  clock: AudioClock;
  /** 玩家校准值（秒），正数表示玩家习惯按晚。判定时从输入时间里扣除 */
  calibration(): number;
  /** 已加载并通过校验的全部谱面；场景按 chart.scene 挑出自己的 */
  charts: readonly Chart[];
  /** 离开场景、回到街区大厅（选关界面的「后退」「返回」） */
  leave(): void;
  /** 要打的那一首谱面（网址 #场景/谱面 直接打开某一关时有）；不写时场景先显示关卡列表 */
  chartId?: string;
  /**
   * 开始一关之前调用：游戏外壳显示这一关的开场页（关卡名、速度、部件、最佳成绩、玩法）。
   * 开场页由玩家的第一下空格或点击收起，这一下照常传给场景，场景收到后再开始。
   * 不提供时（单元测试、原型页面）场景直接开始。
   */
  introduce?(chartId: string): void;
}

export interface Scene {
  /** 场景的全部画面，按 1280×720 的逻辑坐标绘制 */
  readonly view: Container;
  /** 每帧调用一次 */
  update(frame: FrameInfo): void;
  /** 玩家输入；不需要输入的场景可以不实现 */
  onTap?(tap: TapInfo): void;
  /** 玩家松开了空格或鼠标 / 触摸（长按动作用）；没有长按动作的场景可以不实现 */
  onRelease?(tap: TapInfo): void;
  /**
   * 玩家按了 Esc。场景自己处理了（例如从关卡回到关卡列表）就返回 true；
   * 返回 false 或不实现时，由游戏入口回到街区大厅。
   */
  onEscape?(): boolean;
  /** 离开场景时调用，释放画面和其他资源 */
  destroy(): void;
}

export interface SceneEntry {
  /** 场景标识，与场景目录（scenes/catalog.ts）一致 */
  id: SceneId;
  /** 给人看的名称，例如「Windows XP 桌面」 */
  label: string;
  /** 场景素材（图片、字体、音效）的加载；游戏启动时等它完成，之后 create() 可以同步取用 */
  preload?(audio: BaseAudioContext): Promise<void>;
  /** 显示这个场景时游戏画面上的鼠标指针（CSS cursor 值）；不写时用浏览器默认指针 */
  cursor?: string;
  create(context: SceneContext): Scene;
}
