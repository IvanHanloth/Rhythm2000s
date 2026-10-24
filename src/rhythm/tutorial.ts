// 系统演示（doc/level-design.md「规则 1」）：进关后先把谱面用到的每种动作逐个演示一遍，
// 玩家跟打成功才进入下一种，全部成功后才开始谱面正文；演示不计分。
// 这里只管「演示哪些动作、每一轮的小谱面、算不算成功、提示文案」，画面和流程由各场景自己接。
// 不依赖 PixiJS，便于测试。

import type { ActionType } from './actions.ts';
import { buildChart, type Chart } from './chart.ts';
import type { JudgementLevel } from './judge.ts';

/** 谱面用到的动作，按第一次出现的先后（示范和跟打都算） */
export function tutorialActions(chart: Chart): ActionType[] {
  const cues = [...chart.calls, ...chart.responses].sort((a, b) => a.beat - b.beat);
  return [...new Set(cues.map((cue) => cue.action))];
}

/**
 * 演示一种动作的小谱面：和原谱面同样的速度、拍号；1 小节预备拍，一个乐句（示范 + 跟打），
 * 动作放在小节第 1 拍；没有结尾留空。
 */
export function buildTutorialChart(chart: Chart, action: ActionType): Chart {
  return buildChart({
    format: 1,
    id: `${chart.id}--tutorial--${action}`,
    title: chart.title,
    scene: chart.scene,
    bpm: chart.bpm,
    beatsPerBar: chart.beatsPerBar,
    countInBars: 1,
    outroBars: 0,
    responseGapBeats: 0,
    phrases: [{ call: [{ beat: 0, action }] }],
  });
}

/** 这一轮算不算成功：每一下都判过了，而且没有 Miss */
export function tutorialPassed(levels: readonly JudgementLevel[], targets: number): boolean {
  return levels.length >= targets && levels.every((level) => level !== 'miss');
}

/** 提示条上的文字。只用英文（2026-10-24 起新增的显示内容一律英文） */
export interface TutorialHint {
  /** 动作名称 */
  name: string;
  /** 怎么处理 */
  how: string;
}

/** 键是动作 ID。用普通字符串作键，新动作的提示可以和动作本身分开加 */
const HINTS: Record<string, TutorialHint> = {
  'dialog-info': { name: 'Information box', how: 'Close it on the beat' },
  'dialog-warning': { name: 'Warning box', how: 'Close it on the beat' },
  'dialog-error': { name: 'Error box', how: 'Close it on the beat' },
  'dialog-question': { name: 'Question box', how: 'Close it on the beat' },
  'desktop-refresh': { name: 'Refresh', how: 'Right-click, then Refresh half a beat later' },
  'balloon-info': { name: 'Balloon tip', how: 'Close it on the beat' },
  'window-minimize': { name: 'Program window', how: 'Minimize it on the beat' },
  'start-menu': { name: 'Start menu', how: 'Start, then a program half a beat later' },
  'recycle-bin': { name: 'Recycle Bin', how: 'Throw the file away on the beat' },
  'progress-download': { name: 'File download', how: 'Wait for the bar, click Open as it fills' },
  'volume-mute': { name: 'Volume', how: 'Grab the slider on the beat' },
  'alert-note': { name: 'Alert', how: 'Click OK on the beat' },
  'alert-caution': { name: 'Caution alert', how: 'Click OK on the beat' },
  'alert-stop': { name: 'Stop alert', how: 'Click OK on the beat' },
  'dock-bounce': { name: 'Bouncing icon', how: 'Click it on the beat' },
  'mail-new': { name: 'New mail', how: 'Read it on the beat' },
  'window-miniaturize': { name: 'Window', how: 'Minimize it to the Dock on the beat' },
  'menu-apple': { name: 'Apple menu', how: 'Click the Apple, then an item half a beat later' },
  'dock-trash': { name: 'Trash', how: 'Drag the file to the Trash on the beat' },
  'sheet-save': { name: 'Save sheet', how: "Close the window, then Don't Save half a beat later" },
  'ichat-message': { name: 'iChat message', how: 'Click it on the beat' },
  'menu-volume': { name: 'Volume', how: 'Grab the slider on the beat' },
};

/** 某个动作的提示；还没写提示的动作只显示动作 ID */
export function tutorialHint(action: ActionType): TutorialHint {
  return HINTS[action] ?? { name: action, how: 'Do it on the beat' };
}
