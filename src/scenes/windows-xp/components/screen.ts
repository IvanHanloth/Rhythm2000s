// 虚拟 XP 屏幕：部件按原版像素尺寸绘制在 1024×576 的屏幕上，整体放大 1.25 倍铺满 1280×720 的画布。
// 放大倍数是暂定值（doc/scenes/windows-xp.md「尺寸」）。

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';

export const XP_SCALE = 1.25;
export const XP_SCREEN_WIDTH = DESIGN_WIDTH / XP_SCALE;
export const XP_SCREEN_HEIGHT = DESIGN_HEIGHT / XP_SCALE;
export const TASKBAR_HEIGHT = 30;
/** 桌面可用区域的高度（任务栏以上） */
export const WORK_AREA_HEIGHT = XP_SCREEN_HEIGHT - TASKBAR_HEIGHT;
