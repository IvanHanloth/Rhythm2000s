// 动作输入：空格键，或在画面上点击 / 触摸，都算一次动作（doc/prototypes/mvp.md）。
// 输入时间取事件的 timeStamp，换算成「那一刻扬声器正在播放的音频时间」。

import type { AudioClock } from '../audio/audio-clock.ts';
import type { TapInfo } from './scene.ts';

/**
 * event.timeStamp 应与 performance.now() 同一时间轴。
 * 个别旧浏览器给的是纪元时间或 0，这时退回回调时的 performance.now()。
 */
export function resolveTimeStamp(eventTimeStamp: number, now: number): number {
  return eventTimeStamp > 0 && eventTimeStamp <= now + 1 ? eventTimeStamp : now;
}

function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  );
}

/** 监听动作输入。pointerTarget 是游戏画面所在的元素，在它以外的点击不算。 */
export function listenForTaps(
  clock: AudioClock,
  pointerTarget: HTMLElement,
  onTap: (tap: TapInfo) => void,
): void {
  const emit = (eventTimeStamp: number) => {
    const time = resolveTimeStamp(eventTimeStamp, performance.now());
    const audioTime = clock.heardTimeA(time) ?? clock.heardTimeB(time);
    onTap({ audioTime });
  };

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // 在开发面板的输入框、按钮上按空格，交给浏览器处理
    if (isFormControl(event.target)) return;
    // 阻止空格滚动页面
    event.preventDefault();
    emit(event.timeStamp);
  });

  pointerTarget.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    emit(event.timeStamp);
  });

  pointerTarget.addEventListener('contextmenu', (event) => event.preventDefault());
}
