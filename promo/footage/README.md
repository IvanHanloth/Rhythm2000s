# Footage

The video shows the game itself, recorded from the dev server. The `.mp4` files are not committed (`.gitignore`; `xp.mp4` alone is over GitHub's 100 MB limit), so re-record them as below before previewing or rendering; `bed.wav` is committed.

| File | What | How |
| --- | --- | --- |
| `xp.mp4` | 95 s of `#showcase/windows-xp` | `node scripts/record-game.cjs showcase/windows-xp 95 xp.webm` |
| `mac.mp4` | 95 s of `#showcase/mac-2000` | `node scripts/record-game.cjs showcase/mac-2000 95 mac.webm` |
| `hub.mp4` | 8 s of the title screen's street, without its overlay | the same script with the `.hub-ui` overlay hidden and the hub canvas captured |
| `bed.wav` | Part 1's sound: the game's own audio, cut on the film's bar lines | `python3 scripts/build-bed.py` |
| `detail-bed.wav` | Part 2's sound, from the takes below on the same times as `compositions/detail.html` | the same script |
| `xp-full.mp4`, `mac-full.mp4` | the user's screen recordings of a whole round of each scene's last level from the café (175 s, 148 s) | converted as below from the originals |
| `xp-all.mp4`, `mac-all.mp4`, `xp-menu.mp4`, `mac-menu.mp4` | the user's recordings of every widget and of the Start / Apple menu (not used yet) | converted as below |
| `street.mp4` | the user's 38 s walk down the street (no sound; its first 4 s show a browser full-screen notice) | converted as below, `-an` |
| `egg.mp4`, `egg-raw.mp4` | the user's recording of the Rickroll easter egg, cut (34.6 s, used) and uncut | converted as below |
| `xp-110.mp4`, `mac-110.mp4` | `xp.mp4` and `mac.mp4` slowed from 120 to 110 BPM, so Part 2 can cut them on its grid | `ffmpeg -i xp.mp4 -filter_complex "[0:v]setpts=PTS*120/110,fps=30[v];[0:a]atempo=0.9166667[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -g 15 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 xp-110.mp4` |
| `editor-xp.mp4`, `editor-mac.mp4` | the user's recordings of HackerEditor on each system (82 s, 135 s) | converted as below |
| `editor-xp-edit.mp4`, `editor-mac-edit.mp4`, `editor-mac-walk.mp4` | editor-xp 6.4-42.4 s and editor-mac 18-27 s at 3x, editor-mac 104.5-112.5 s at 2x | `ffmpeg -ss 6.4 -to 42.4 -i editor-xp.mp4 -filter_complex "[0:v]setpts=PTS/3,fps=30[v];[0:a]atempo=2,atempo=1.5[a]" -map "[v]" -map "[a]" -c:v libx264 -crf 16 -g 15 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 editor-xp-edit.mp4` (likewise) |
| `guide-xp.mp4`, `guide-mac.mp4` | the user's Beat Guide takes, rings off then H (92 s, 75 s; 110 BPM, bars at 47.439 + 2.1818n and 34.757 + 2.1818m; XP's H lands on the 51.803 bar line) | converted as below |
| `how-to-play.png` | a screenshot of the café's How to Play booklet | from the user |

1. Run `vp dev` in the repository root, then the recorder with `PUPPETEER_CORE` pointing at a `puppeteer-core` install (e.g. the one `npx hyperframes` caches). It records the canvas and the Web Audio output at 2560×1440 with MediaRecorder; captureStream on the WebGL canvas gives no frames in headless Chrome, so it mirrors each frame into a 2D canvas.
2. Convert: `ffmpeg -i xp.webm -vf "fps=30,scale=1920:1080:flags=lanczos" -c:v libx264 -crf 14 -g 15 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 xp.mp4`.
3. Find the bar lines: the showcase runs at 120 BPM, so beats sit every 0.5 s (`ffmpeg -af silencedetect` on the first seconds). In these takes the XP tour's bars start at 1.501 + 2k s and the Mac tour's at 1.178 + 2k s; the `data-media-start` values in `index.html` and the segments in `scripts/build-bed.py` assume them, so a new take needs both updated.
4. The chair-swivel action cuts to the 3D café, which the canvas capture can't see: around 46–48 s both takes are black, and no shot uses them.
5. The user's recordings (2560 x 1440, 24 fps) are converted the same way: `ffmpeg -i in.mp4 -vf "fps=30,scale=1920:1080:flags=lanczos" -c:v libx264 -crf 16 -g 15 -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 out.mp4`. Both whole-round takes run at a steady 110 BPM: `xp-full` bars start at 8.31 + 2.1818n s (count-in first), `mac-full` at 9.47 + 2.1818m s.
6. To find what is on screen at a time, seek each frame (`ffmpeg -ss T -i take.mp4 -frames:v 1`). A low-rate `fps=` filter tiled into a sheet drifted by up to 13 s on these takes and is not to be trusted for timing.

