// Action input: Space, or a click / tap on the game, counts as one action (doc/prototypes/mvp.md).
// Releasing Space, or lifting the mouse / finger anywhere, counts as one "release", for hold actions
// (doc/scenes/windows-xp-levels.md, "Input: release").
// The input time is the event's timeStamp, converted to "the audio the speakers were playing at that moment".

import type { AudioClock } from '../audio/audio-clock.ts';
import type { TapInfo } from './scene.ts';

/**
 * event.timeStamp should share performance.now()'s timeline.
 * Some old browsers give an epoch time or 0; then fall back to performance.now() at callback time.
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
 * Listens for action input. pointerTarget is the game element; clicks outside it don't count.
 * Releases count anywhere (pressing, dragging off the game and letting go still counts).
 * onRelease is only called after a press that was counted.
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
    // Space on the dev panel's inputs and buttons belongs to the browser
    if (isFormControl(event.target)) return;
    // Keep Space from scrolling the page
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
