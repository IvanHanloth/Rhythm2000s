// Hub sounds: sitting at a computer plays its startup sound, XP's logon for XP machines and the classic Mac chime
// for iMacs (original assets, ADR 0004). Shares the game's audio context. Both load with the street, through three's
// default loading manager so the title screen's loading bar counts them; otherwise the first sit after a refresh
// would wait for the download and decode before the sound plays.

import { DefaultLoadingManager } from 'three';
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
    for (const url of Object.values(STARTUP_URLS)) void this.load(url);
  }

  /** The scene's computer "boots"; does nothing if the sound failed to load */
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
      DefaultLoadingManager.itemStart(url);
      promise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => this.audio.decodeAudioData(data))
        .catch((error: unknown) => {
          console.warn(`Failed to load hub sound ${url}`, error);
          DefaultLoadingManager.itemError(url);
          return null;
        })
        .finally(() => DefaultLoadingManager.itemEnd(url));
      this.cache.set(url, promise);
    }
    return promise;
  }
}
