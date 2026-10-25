# Cross-dimension action: the swivel-chair spin

> Status: Draft — **prototype**. Only "the press takes the game back to 3D, the character spins once, then the game resumes" is the user's idea; every number, name and rule below is a provisional choice made to get something playable, waiting for the user's decision (see "Open questions").

## Idea

On a press the 2D desktop gives way to the 3D net café ([hub.md](hub.md)): the camera pulls out of the monitor, the whale girl spins once on her swivel chair, and the camera pushes back into the screen as the level carries on. It plays like every other action: the game demonstrates it in the call, the player repeats it in the response.

## Provisional rules (prototype)

| Item | Provisional choice |
| --- | --- |
| Action ID | `chair-swivel`, the café's swivel chair (`office-chair` in [hub-assets.md](hub-assets.md)). **Not an OS class**, so it departs from [ADR 0006](decisions/0006-actions-named-after-ui-classes.md) |
| Scene | `windows-xp` and `mac-2000`, each at its own café computer (the beige CRT / the iMac) |
| Presses | One judged press on the beat; the landing 2 beats later is completed by the game (`auto`, like `volume-mute`'s release), neither judged nor scored |
| Call | The virtual mouse clicks the middle of the desktop on the beat, the cutaway runs for 2 beats |
| Response | A hit starts the same cutaway from the moment of the press; a Miss stays in 2D (the miss beep only) |
| Cutaway timing | 0–0.5 beat: out of the monitor, over the shoulder, up behind the chair · 0.5–1.5: one full turn · 1.5–2: back the same way into the monitor |
| Bar | The event occupies its bar for 2 beats like other multi-press actions; at 120 BPM it starts before beat 1.24 ([chart-format.md](chart-format.md#timing-limits)) |
| Sounds | XP: press with the usual click (`navigate`), landing on `Windows XP Restore.wav` · Mac: press on `Tink`, landing on `Pop` |
| Levels | Only the last level of each scene, in its final section: `xp-system-overload` (`#windows-xp/xp-system-overload`) and `mac-jaguar-rush` (`#mac-2000/mac-jaguar-rush`) ([ADR 0016](decisions/0016-five-official-levels-per-scene.md)). The development test levels `xp-chair-spin` and `mac-chair-spin` were removed with the other development charts |

## How it is built

- **The café stays loaded.** Leaving the street for a level only hides the 3D hub and stops its own loop ([ADR 0005](decisions/0005-3d-street-hub-with-threejs.md)); the cutaway reuses it, with the character in the seat of the scene's computer even when the level was opened from a URL.
- **Audio clock.** The hub's own loop is not used: every frame of the cutaway is posed from the round's audio beat, called from the level's frame (AGENTS.md rule 4).
- **Layers.** The 3D canvas shows underneath; the 2D canvas stays on top with a transparent background, so the turn banner, judgement labels and beat guide stay visible over the café. The desktop crossfades out over the first 1/8 beat and back in over the last.
- **The monitor.** When the cutaway starts, the desktop is captured once and shown on the 3D monitor, so the camera pulls out of the same picture the player was looking at.
- **No stutter on the beat.** When a round with `chair-swivel` starts, the café is rendered once off screen so its shaders and textures are ready before the first spin.
- **Input.** Space and clicks still go to the 2D canvas on top; the hub ignores its own keys during the cutaway.

## Open questions

- [ ] Name: keep `chair-swivel` with an exception to ADR 0006, or tie the action to a period widget (an XP 3D screen saver such as 3D Pipes; Mac OS X's cube switch is 10.3, outside the 10.0–10.2 era)
- [ ] One press, or two (leave and land)?
- [ ] Length in beats, and how far the camera pulls back
- [ ] Should the call cut to 3D too? (Two cutaways per phrase)
- [ ] What a Miss looks like (stay in 2D, a half spin that wobbles, nearly falling off the chair…)
- [ ] Its own call sound (Rhythm Heaven gives every action a cue you can hear)
- [ ] The CRT is 4:3 and the game 16:9, so the cut into the monitor can't line up exactly; is the crossfade enough?
- [ ] An ADR once the rules are settled
