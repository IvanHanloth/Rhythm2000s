# Technical research: platform and stack

> Status: Draft
>
> Summary: **the browser fully supports Rhythm Heaven-style play**. Web first, with a desktop wrapper only if the game ships on Steam. TypeScript + PixiJS + Vite+ was adopted, see [ADR 0001](decisions/0001-tech-stack.md).

## 1. What the game actually needs

| Need | Notes | Difficulty |
| --- | --- | --- |
| Accurate audio clock | Call cues, backing and feedback sounds must land on the beat | Critical |
| Accurate input time | When the press happened on the audio timeline, not when JS received it | Critical |
| Latency calibration | Speakers, Bluetooth headphones and displays all add latency | Critical (on any platform) |
| 2D animation | Windows opening and closing, squash and stretch, particles, driven by the audio clock | Medium |
| Few inputs | One to three keys or mouse clicks | Easy |
| No real OS control | The XP and Mac desktops are drawn in the game | — |

Not needed: physics, huge object counts, online play, osu!-grade judging. Rhythm Heaven's windows are fairly forgiving and the play is about hearing the rhythm, which suits the web.

## 2. Can the browser do it?

### 2.1 Audio scheduling — yes

Web Audio has its own sample-accurate clock, `AudioContext.currentTime`, unaffected by main-thread stalls. `AudioBufferSourceNode.start(when)` books a sound for an exact future time. A small "conductor" converts beat-based chart events to audio clock times and books them a little ahead (AGENTS.md, rule 4).

### 2.2 Input timestamps — yes

- Keyboard, mouse and touch events carry `event.timeStamp`, a high-resolution time on `performance.now()`'s timeline recording when the event happened, not when the callback ran.
- `AudioContext.getOutputTimestamp()` returns a `{contextTime, performanceTime}` pair, which converts `event.timeStamp` to the audio timeline.
- `AudioContext.outputLatency` estimates output latency; supported since Chrome/Edge 102, Firefox 70 and Safari 18.4 ([web.dev](https://web.dev/articles/audio-output-latency), [caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency)).

```
input audio time = event.timeStamp converted to the AudioContext timeline
offset = input audio time − target beat time − output latency − player calibration
```

### 2.3 Latency — about the same as native

Output latency comes mostly from sound card buffers, the system mixer and Bluetooth (which can exceed 100 ms, [ref](https://bugnet.io/blog/bug-tracking-for-rhythm-and-music-games)), natively too. Native clients can go lower with WASAPI exclusive mode or ASIO, which only extreme-judging games need. **Calibration matters more than absolute latency**, and works in the browser: have the player tap along, take the median and drop outliers ([Rhythm Quest discussion](https://itch.io/post/9879297)).

### 2.4 Visuals — yes

`requestAnimationFrame` draws each frame from the audio clock without accumulating deltas, so a dropped frame only makes the picture jump; judging uses input timestamps. Canvas / WebGL (PixiJS) handles the retro UI easily.

### 2.5 Real browser limits

| Limit | Effect | Mitigation |
| --- | --- | --- |
| Autoplay policy: no sound before a click | A click is needed before play | "Click to start", which also resumes the `AudioContext` |
| Background tabs are throttled | Timing breaks in the background | Pause on `visibilitychange` |
| Chrome parks a silent `AudioContext` on a fake output after about 30 s of silence ([SilentSinkSuspender](https://chromium.googlesource.com/chromium/src.git/+/74.0.3702.1/media/base/silent_sink_suspender.cc)) | The first sounds after a quiet spell (walking the street, the level list) are lost while it switches back to the speakers | `AudioClock` plays an inaudible constant signal (1e-5, about −100 dB) for as long as the page lives, so the output never counts as silent |
| Some system shortcuts can't be captured | Those keys can't be game keys | Only a few keys are used anyway |
| Context menu and text selection | Mouse play misfires | Prevent `contextmenu` and `selectstart` |
| Latency varies by browser and device | Inconsistent feel | Calibration plus testing per platform |
| No Steam achievements or cloud saves | Only matters on Steam | A desktop wrapper (section 4) |

No hard blocker requires a native client; only distribution (Steam) might.

## 3. Options considered

TypeScript + native Web Audio + PixiJS won: full control of the audio clock, small and fast to load, playable in a browser, wrappable for desktop without changes. Also considered: Godot 4 (editor and multi-platform export, but large web builds and unverified web audio sync), Unity (WebGL audio is basic, heavy for a 2D game), fully native (loses the web for little gain), PocketJS (an embedded UI runtime without input timestamps or an audio clock), and pure DOM/CSS (fine for menus, hard to time for animation). Howler.js-style wrappers were rejected because they don't schedule precisely; Tone.js's Transport could, but is heavy.

## 4. A desktop client later

| Wrapper | Engine | Notes |
| --- | --- | --- |
| **Electron** | Bundled Chromium | Same audio and rendering on every platform; Steam libraries exist (steamworks.js); ~100 MB |
| Tauri 2 | System WebView (WebView2 on Windows, WebKit on macOS) | Small, but macOS runs Safari's engine, whose audio behaves differently and needs its own testing |

Prefer Electron for a Steam release. On mobile the browser works (touch is close to Rhythm Heaven's handheld play) and Capacitor can package it, but touch and audio latency need measuring.

## 5. Risks to verify with the latency prototype

1. Whether `outputLatency` matches measurements on Windows (Chrome / Edge / Firefox) and macOS (Safari / Chrome).
2. The offset distribution of keyboard, mouse and touch after converting `event.timeStamp`.
3. How much having to move the mouse onto a target hurts rhythm judging (the open input question in [game-design.md](game-design.md)).
4. Whether calibration makes Bluetooth headphones playable.
5. Whether `getOutputTimestamp()` works on current Safari (it misbehaved on iOS 15.1, [Apple forums](https://developer.apple.com/forums/thread/696356)).

## References

- [web.dev: Synchronize audio and video playback on the web](https://web.dev/articles/audio-output-latency)
- [MDN: AudioContext.outputLatency](https://developer.mozilla.org/docs/Web/API/AudioContext/outputLatency)
- [Godot 4.5: Exporting for the Web](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)
- [PocketJS (GitHub)](https://github.com/pocket-stack/pocketjs)
- [Unity: WebGL audio](https://docs.unity3d.com/cn/2022.3/Manual/webgl-audio.html)
- [Apple forums: getOutputTimestamp](https://developer.apple.com/forums/thread/696356)
