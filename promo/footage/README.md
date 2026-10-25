# Footage

The video shows the game itself, recorded from the dev server; these files are not committed (`.gitignore`).

| File | What | How |
| --- | --- | --- |
| `xp.mp4` | 95 s of `#showcase/windows-xp` | `node scripts/record-game.cjs showcase/windows-xp 95 xp.webm` |
| `mac.mp4` | 95 s of `#showcase/mac-2000` | `node scripts/record-game.cjs showcase/mac-2000 95 mac.webm` |
| `hub.mp4` | 8 s of the title screen's street, without its overlay | the same script with the `.hub-ui` overlay hidden and the hub canvas captured |
| `bed.wav` | the game's own audio, cut on the film's bar lines | `python3 scripts/build-bed.py` |

1. Run `vp dev` in the repository root, then the recorder with `PUPPETEER_CORE` pointing at a `puppeteer-core` install (e.g. the one `npx hyperframes` caches). It records the canvas and the Web Audio output at 2560×1440 with MediaRecorder; captureStream on the WebGL canvas gives no frames in headless Chrome, so it mirrors each frame into a 2D canvas.
2. Convert: `ffmpeg -i xp.webm -vf "fps=30,scale=1920:1080:flags=lanczos" -c:v libx264 -crf 14 -g 15 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 xp.mp4`.
3. Find the bar lines: the showcase runs at 120 BPM, so beats sit every 0.5 s (`ffmpeg -af silencedetect` on the first seconds). In these takes the XP tour's bars start at 1.501 + 2k s and the Mac tour's at 1.178 + 2k s; the `data-media-start` values in `index.html` and the segments in `scripts/build-bed.py` assume them, so a new take needs both updated.
4. The chair-swivel action cuts to the 3D café, which the canvas capture can't see: around 46–48 s both takes are black, and no shot uses them.
