// Hub sounds: sitting at a computer plays its startup sound, XP's logon for XP machines and the classic Mac chime
// for iMacs (original assets, ADR 0004). Downloaded and decoded on first use, then cached; shares the game's audio context.

import type { SceneId } from '@/scenes/catalog.ts';
import xpLogonUrl from '@assets/reference/windows-xp/sounds/Windows XP Logon Sound.wav?url';
import macChimeUrl from '@assets/reference/mac-os-classic/sounds/Startup Chime.mp3?url';

const STARTUP_URLS: Record<SceneId, string> = {
  'windows-xp': xpLogonUrl,
  'mac-2000': macChimeUrl,
};

const VOLUME = 0.55;

export class HubSounds {
  private readonly audio: AudioContext;
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();

  constructor(audio: AudioContext) {
    this.audio = audio;
  }

  /** The scene's computer "boots"; does nothing if the sound fails to load */
  playStartup(sceneId: SceneId): void {
    const url = STARTUP_URLS[sceneId];
    void this.load(url).then((buffer) => {
      if (!buffer) return;
      const source = this.audio.createBufferSource();
      const gain = this.audio.createGain();
      gain.gain.value = VOLUME;
      source.buffer = buffer;
      source.connect(gain).connect(this.audio.destination);
      source.start();
    });
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let promise = this.cache.get(url);
    if (!promise) {
      promise = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => this.audio.decodeAudioData(data))
        .catch((error: unknown) => {
          console.warn(`Failed to load hub sound ${url}`, error);
          return null;
        });
      this.cache.set(url, promise);
    }
    return promise;
  }
}
