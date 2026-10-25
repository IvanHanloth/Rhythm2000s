# SPEC: Call & Response (storyline A)

The film is four parts: the quick cut (below, 0–41 s), the detailed walkthrough that follows the
user's `Demostration.md` (Part 2), a second end card, then the Rickroll easter egg as a
post-credits scene (it always comes last, after the logo).

## Part 1: the quick cut

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
  5  10.1-12.1 XP Security Warning pops, call bar (xp 5.501). "Simon says:" on beat 1.
  6  12.1-14.1 same take: its OK is clicked shut on the bar line. "click OK." on beat 1, under it.
               From 13.9 the whip carries an empty desktop (xp 11.6), since the take's next dialog
               pops at 13.93.
  7  14.1-16.1 whip to Mac: "iTunes has unexpectedly quit" alert (mac 9.178), punched in 1.8x on
               beat 2. No words: the pause between the tagline's two sentences.
  8  16.1-18.1 Mac Perfect! bar (mac 49.178). "On the beat."
  9  18.1-22.1 four desktops, XP / Mac / Mac / XP, each the top-left quarter of its take at 1:1
               (xp 13.501, mac 4.678, mac 20.178, xp 24.001): a window pops on each beat of the first
               bar and closes on each beat of the second. Sound: the four takes mixed.
  10 22.1-24.1 Mac combo bubbles (mac 69.178). "16 in a row".
  11 24.1-26.1 XP Media Player visualization at 16 (xp 69.501).
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

## Part 2: the detailed walkthrough, end card and easter egg

```text
GOAL:    a viewer who liked the quick cut sees the whole game: the café, the rules, both desktops,
         every widget, the chair, the combo tiers, the results, HackerEditor; then the egg.
TIME:    detail 143.742 s from film 41.0; second end card 184.742-191.642; egg 191.642-226.242.
         Gameplay runs at the Heaven charts' 110 BPM: a beat 0.5455 s, a bar 2.1818 s.
         Bar lines in the takes: xp-full 8.31 + 2.1818n (count-in at 8.31, first call 10.49),
         mac-full 9.47 + 2.1818m (count-in 7.29). The showcase takes (120 BPM) are pre-slowed to
         footage/xp-110.mp4 and mac-110.mp4 (a showcase time t becomes t x 12/11, sound pitch-kept),
         so their bars land on the same grid without a playback rate.
         Detail-local bar k starts at T0 + 2.1818k, T0 = 13.66.
LOOK:    as Part 1: the game's own screens full frame, Baloo 2 ExtraBold titles right-aligned at
         top 300 / 430, 120 px, white with the 14 px focus-blue stroke and 6 px shadow.
         The How to Play booklet (footage/how-to-play.png) is the one still, shown full bleed.
MOTION:  hard cuts on bar lines; one push-in on the booklet (1.0 -> 1.5, 0.4 s power3.inOut);
         titles hit like Part 1 (0-frame set to 1.12, 6-frame settle) and leave in 4 frames.
SHOTS:   (detail-local time t; source = take time)
  A  0.0-13.66   into the café: street walk (street 14.0) "Here's how it plays", "Into the Cyberspace
                 Café"; XP desk (xp-full 0.25) + XP Logon sound "Sit at the XP PC"; Mac desk
                 (mac-full 0.45) + Mac startup chime "or the iMac"; Explorer (xp-full 3.5) and Finder
                 (mac-full 3.6) "Pick a level"; XP Heaven card (xp-full 6.25) runs on into the round.
  B  k0-k8       how it plays: k0 the booklet over the count-in, pushing in on 1 and 2; k1 Follow me
                 "The computer goes first"; k2 Your turn + Perfect "You copy it, on the beat";
                 k3-4 Practice 2 "Each new pop-up starts with practice"; k5-8 jump to xp-full 54.13:
                 k6 a Miss "Perfect, Good or Miss", k7 Try again "Miss? Try again".
  C  k9-k16      both desktops, two bars each with their own sound: Mac m9 "Same rules on a Mac",
                 XP n12 "It gets harder as you go", Mac m15, XP n14. No title names a level.
  D  k17-k20     Beat Guide (xp-full 73.76, rings on) "Lost the beat? Press H", "Rings close in on the
                 beat". PLACEHOLDER: replace with the user's H on/off recording.
  E  k21-k26     every widget: 12 half-bar cuts, XP and Mac alternating, each starting on the bar
                 line its window pops; only widgets that stay on screen for the whole half bar (menus,
                 the context menu, the save sheet and the volume slider flash for a frame and are out)
                 "Every widget / true to the original".
  F  k27-k30     the swivel chair: XP n53 (xp-full 126.13), Mac m41 (mac-full 98.93) "The chair spins
                 on the beat".
  G  k31-k36     combo tiers from the showcase takes: 16 (Media Player visualization / Aqua
                 bubbles) one bar each, 30 (Solitaire cascade / Flurry) two bars each; "16 in a row",
                 "30!". Tier 1 (8) shows no visible change in the takes, so it is left out.
  H  k37-k39     results: XP "OK" (xp-full 171.95), Mac "Superb" (mac-full 144.75) "Then your rating
                 and timing".
  I  99.84-143.74 HackerEditor, from the user's recordings, with their own sound: sitting at the XP
                 editor and "Welcome Back Hacker" "One row back: HackerEditor"; editing at 3x "Click actions
                 onto the beat", "The response copies the call"; a Test run "Test it right away"; Mac
                 editing at 3x "Same on the Mac"; saving "Save it…"; the walk to the front row at 2x; the
                 play iMac's Finder listing "demo", its card and the round "…and it's a level".
                 Import and export were not recorded and are not shown.
  End card       the Part 1 end card again over the street, with the Mac startup chime.
  Egg            footage/egg.mp4 with its own sound, "Finish three levels…" over its first bars.
SOUND:   footage/detail-bed.wav, built by scripts/build-bed.py from the same takes and times as the
         shots (silent before the Heaven card except the Logon sound and the chime; the sped-up editor
         cuts keep their sound sped up, pitch kept); the egg keeps its own sound.
QA:      detail t 1.0 (street + title), 15.9 (Follow me + title), 18.1 (Perfect), 27.0 (Miss),
         34.0 (Mac), 52.0 (rings), 60-73 (every montage cut shows its window), 72.0 (3D chair),
         84.0 (Solitaire), 94.5 (results), 101 (editor opening), 108 (editing), 118 (test),
         133 ("demo" in Finder), film 188.7 (end card), 193.1 (egg).
```
