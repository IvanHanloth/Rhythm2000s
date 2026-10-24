// 动作输入：空格键，或在画面上点击 / 触摸，都算一次动作（doc/prototypes/mvp.md）。
// 松开空格、鼠标 / 触摸在任何地方抬起算一次「松开」，给长按动作用（doc/scenes/windows-xp-levels.md「输入：松开」）。
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

/**
 * 监听动作输入。pointerTarget 是游戏画面所在的元素，在它以外的点击不算；
 * 松开不限位置（按下后拖到画面外再松手也算）。onRelease 只在之前算过一次按下时才调用。
 */
export function listenForTaps(
  clock: AudioClock,
  pointerTarget: HTMLElement,
  onTap: (tap: TapInfo) => void,
  onRelease?: (tap: TapInfo) => void,
): void {
  const toTap = (eventTimeStamp: number): TapInfo => {
    const time = resolveTimeStamp(eventTimeStamp, performance.now());
    return { audioTime: clock.heardTimeA(time) ?? clock.heardTimeB(time) };
  };
  const emit = (eventTimeStamp: number) => onTap(toTap(eventTimeStamp));
  /** 正按着的空格和指针（pointerId）；松开时只认按下时算过数的 */
  let spaceDown = false;
  const pointersDown = new Set<number>();
  const release = (eventTimeStamp: number) => onRelease?.(toTap(eventTimeStamp));

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // 在开发面板的输入框、按钮上按空格，交给浏览器处理
    if (isFormControl(event.target)) return;
    // 阻止空格滚动页面
    event.preventDefault();
    spaceDown = true;
    emit(event.timeStamp);
  });

  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' || !spaceDown) return;
    spaceDown = false;
    release(event.timeStamp);
  });

  pointerTarget.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    pointersDown.add(event.pointerId);
    emit(event.timeStamp);
  });

  const pointerUp = (event: PointerEvent) => {
    if (!pointersDown.delete(event.pointerId)) return;
    release(event.timeStamp);
  };
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);

  // 切走窗口时收不到 keyup / pointerup，当作全部松开
  window.addEventListener('blur', () => {
    if (!spaceDown && pointersDown.size === 0) return;
    spaceDown = false;
    pointersDown.clear();
    release(performance.now());
  });

  pointerTarget.addEventListener('contextmenu', (event) => event.preventDefault());
}
