// Virtual XP screen: widgets are drawn at original pixel size on a 1024×576 screen scaled 1.25× to fill
// the 1280×720 canvas (doc/scenes/windows-xp.md "Size").

import { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/game/layout.ts';

export const XP_SCALE = 1.25;
export const XP_SCREEN_WIDTH = DESIGN_WIDTH / XP_SCALE;
export const XP_SCREEN_HEIGHT = DESIGN_HEIGHT / XP_SCALE;
export const TASKBAR_HEIGHT = 30;
/** Height of the desktop work area (above the taskbar) */
export const WORK_AREA_HEIGHT = XP_SCREEN_HEIGHT - TASKBAR_HEIGHT;
