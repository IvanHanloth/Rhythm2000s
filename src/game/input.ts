// Action input: Space, or a click / tap on the game, counts as one action (doc/prototypes/mvp.md).
// The input time is the event's timeStamp, converted to "the audio the speakers were playing at that moment".

import type { AudioClock } from '@/audio/audio-clock.ts';
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

/** Listens for action input. pointerTarget is the game element; clicks outside it don't count. */
export function listenForTaps(
  clock: AudioClock,
  pointerTarget: HTMLElement,
  onTap: (tap: TapInfo) => void,
): void {
  const emit = (eventTimeStamp: number) => {
    const time = resolveTimeStamp(eventTimeStamp, performance.now());
    onTap({ audioTime: clock.heardTimeA(time) ?? clock.heardTimeB(time) });
  };

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Space on the dev panel's inputs and buttons belongs to the browser
    if (isFormControl(event.target)) return;
    // Keep Space from scrolling the page
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
