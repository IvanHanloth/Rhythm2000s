// Dance machine keys (doc/dance-machine.md): the arrow keys and WASD step on the pad; Enter and Space work the menus.
// Which arrows are held is tracked too, so the screen can light the direction they make (← and ↑ held light ↖).
// Step times are converted to the audio being heard at the key press, like the scenes' taps (src/game/input.ts).

import type { AudioClock } from '@/audio/audio-clock.ts';
import { resolveTimeStamp } from '@/game/input.ts';
import type { Arrow } from './steps.ts';

const ARROW_KEYS: Readonly<Record<string, Arrow>> = {
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
  KeyA: 'left',
  KeyS: 'down',
  KeyW: 'up',
  KeyD: 'right',
};

/** The arrow a key code steps on; null for other keys */
export function arrowForKey(code: string): Arrow | null {
  return ARROW_KEYS[code] ?? null;
}

export interface PadHandlers {
  /** An arrow was pressed; `audioTime` is the heard time of the press, before calibration */
  step(arrow: Arrow, audioTime: number): void;
  /** Enter or Space */
  confirm(): void;
}

export interface Pad {
  /** The arrows held down right now */
  readonly held: ReadonlySet<Arrow>;
  /** Stops listening */
  stop(): void;
}

/** Listens for pad keys until stop() is called */
export function listenForPad(clock: AudioClock, handlers: PadHandlers): Pad {
  /** Held key codes: an arrow is held while its arrow key or its WASD key is down */
  const codes = new Set<string>();
  const held = new Set<Arrow>();
  const refresh = () => {
    held.clear();
    for (const code of codes) {
      const arrow = arrowForKey(code);
      if (arrow) held.add(arrow);
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      return;
    const arrow = arrowForKey(event.code);
    if (arrow) {
      // Arrow keys would scroll the page
      event.preventDefault();
      codes.add(event.code);
      refresh();
      const time = resolveTimeStamp(event.timeStamp, performance.now());
      handlers.step(arrow, clock.heardTimeA(time) ?? clock.heardTimeB(time));
      return;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') {
      event.preventDefault();
      handlers.confirm();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (!codes.delete(event.code)) return;
    refresh();
  };
  // Keys released while the page is in the background never send keyup
  const onBlur = () => {
    codes.clear();
    refresh();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return {
    held,
    stop: () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
