# SPEC: Call & Response (storyline A)

```text
GOAL:    a stranger gets the game in 10 s (the computer shows, you repeat on the beat) and remembers
         "Rhythm 2000s" and where to play it.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    41.0 s x 30 = 1230 frames. 120 BPM, 15 frames a beat, 60 a bar. The film's bar lines sit at
         0.1 + 2k s (the opening shot starts 0.1 s before bar 1 so frame 0 already shows a dialog).
LOOK:    the game's own screens, captured from the showcase computers (#showcase/windows-xp,
         #showcase/mac-2000) at 2560 x 1440 and scaled to 1080p; nothing redrawn.
         Display face Baloo 2 ExtraBold (the logo face in src/theme/tokens.ts), 120 px titles,
         -1% tracking, white #ffffff with a hard 6 px offset shadow in XP focus blue #0b2f6e,
         exactly as the title screen's logo. Accent: Perfect yellow #f2b705 with ink #1b1b1b,
         only on the "2000s" badge and the play URL.
         Grounds between worlds: Luna titlebar blue #0a52c8 (XP) and Aqua accent #1d5fd0 (Mac).
OBJECTS: XP dialogs (info, error, warning), Notepad, the Mac empty-Trash alert, iChat message,
         Perfect! / Good labels, the combo counter, the XP Solitaire cascade, the Aqua ribbons,
         the 3D British high street with CYBERSPACE CAFE.
MOTION:  words hit on the beat: a 0-frame set to scale 1.12, settling to 1.0 over 6 frames
         (expo.out); exits 4 frames, blur 8 px + fade. Punch-ins 1.0 -> 1.8 over 12 frames
         power3.inOut, landing on the second beat of the call bar. Colour flood 9 frames power2.inOut.
SHOTS:   (film time; source = recording time)
  1  0.0-2.1   XP info dialog, call bar (xp 1.401). "Watch" / "and listen" land on beats 2, 3.
  2  2.1-4.1   same dialog, response bar (xp 3.501): it closes on the beat. "Your turn".
  3  4.1-8.1   XP error dialog phrase (xp 9.501), punched in 1.8x on the dialog.
  4  8.1-10.1  logo on Luna blue, flooded up from the taskbar; "Rhythm" on beat 1, badge on beat 3.
  5  10.1-12.1 XP question dialog, call bar (xp 13.501). "Pop-ups,".
  6  12.1-14.1 same dialog, response bar (xp 15.501): closed. "close boxes,".
  7  14.1-16.1 whip to Mac: iChat message arrives (mac 36.678). "new mail".
  8  16.1-18.1 Mac Perfect! bar (mac 49.178). "all on the beat."
  9  18.1-22.1 Mac empty-Trash phrase (mac 5.178), punched in 1.8x.
  10 22.1-24.1 Mac combo bubbles (mac 69.178). "16 in a row".
  11 24.1-26.1 XP combo flower at 16 (xp 69.501).
  12 26.1-30.1 XP Solitaire cascade, the payoff (xp 73.501). "30!".
  13 30.1-32.1 Mac ribbons (mac 75.178).
  14 32.1-34.1 XP combo break: 30 for two beats, then the counter falls to 0 (xp 80.501). "Miss one…".
  15 34.1-41.0 iris onto the 3D high street (title camera pan); logo performed in, tagline,
               "Play it in your browser" + ivanhanloth.github.io/Rhythm2000s. XP Startup sound.
SOUND:   the game's own audio from the same recordings (drums + widget sounds), cut on bar lines
         into one bed (footage/bed.wav); the XP Startup sound under the end card.
BANNED:  dark void, glow/particles added by us, purple/blue gradients, glass cards, everything
         centred, fade-and-slide-up, titles drifting after they land, three cards, docked logo,
         redrawn or mocked UI, any claim not in the game's docs.
QA:      t=0 (dialog visible), 2.2 (dialog closed on the beat), 6.0 (punch-in readable),
         9.5 (logo), 15.0 (Mac), 28.0 (Solitaire payoff), 33.0 (counter at 0), 39.0 (end card).
```
