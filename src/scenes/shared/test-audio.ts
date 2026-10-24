// Unit tests only: a stand-in SceneContext whose audio graph records which sounds play.
// Sounds are named by strings in place of real AudioBuffers.

import type { SceneContext } from '@/game/scene.ts';

export function fakeContext(calibration = 0) {
  /** Sounds played immediately (feedback on input) */
  const played: string[] = [];
  /** Sounds booked for a later time */
  const scheduled: { name: string; when: number }[] = [];
  const audio = {
    currentTime: 10,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        connect() {},
        stop() {},
        start(when?: number) {
          const name = source.buffer as string;
          if (when === undefined) played.push(name);
          else scheduled.push({ name, when });
        },
      };
      return source;
    },
  };
  const cutaway = { prepare() {}, show() {}, hide() {} };
  const context = { clock: { context: audio }, calibration: () => calibration, cutaway };
  return { context: context as unknown as SceneContext, played, scheduled };
}
