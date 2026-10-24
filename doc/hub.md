# Title screen and street hub

> Status: Draft

The title screen and level select both take place in one 3D street. Technology choice: [ADR 0005](decisions/0005-3d-street-hub-with-threejs.md).

## Decided

- The title screen overlays the logo and menu on the street. The menu is "Start" and "Credits"; "Start" drops the camera behind the character, who can walk straight away. Keys are listed in the in-game settings window ([settings.md](settings.md#keyboard-shortcuts)), and the latency test lives there too ([latency-test.md](latency-test.md)).
- "Credits" opens a panel listing, in order: the makers ([@IvanHanloth](https://github.com/IvanHanloth) and [@Pleasurecruise](https://github.com/Pleasurecruise), linked to their GitHub profiles), that the game was made during the HackNotts 26 hackathon, the repository link, the asset attributions, and a legal notice on the Microsoft, Apple and Nintendo trademarks and materials. The README carries the same credits and notice.
- Third-person follow camera, turned with the mouse.
- A street of the 2000s with a few shops to walk into; the net café's computers are the level entries.
- All text in the world (signs, posters, screens, shop names) and all overlays (menus, hints, dialogue) are English.
- Realistic models and materials, bright with a dreamcore feel; period props are made by the user in Tripo / Blender, spec and list in [hub-assets.md](hub-assets.md).
- Millennial details on a British high street around 2000 (the project is a UK hackathon entry).
- One chart is one level. The café has one entry computer per scene (XP and Mac); the card shown when seated lists that computer's levels and how many have scores, and levels are picked inside in Explorer / Finder.
- The player character is the DeepSeek whale girl, a ready-made model (ai-girls-3d adult version, CC BY 4.0; source and changes in assets/README.md). It has no animations; walking, sitting and typing turn its bones in code.

## Flow

```
Title ──"Start"──► walk the street ──door──► net café
  ▲                                            │ E at a computer
  │                                            ▼
  └── pause menu "Quit to title"        seated: level info on screen
                                               │ E starts / Esc stands up
                                               ▼
                        camera pushes into the screen ──► level list on the computer ──► level
                                               │ Esc or "Back" on the list
                                               ▼
                                         back in the seat
```

The level list on the computer (XP Explorer / Mac Finder) is in [level-select.md](level-select.md). Esc in a level first returns to the list, and again to the seat.

Picking a level shows its intro (scene and level number, title, tempo, widgets, best score, how to play); Space or a click starts. A results window follows each round, see [results.md](results.md). The URL `#scene/chart` (e.g. `#mac-2000/mac-dock-hop`) opens a level's intro directly; `#scene` alone shows that computer's level list.

The intro takes the scene's colours: Luna for XP levels, Aqua for Mac levels.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move (relative to the camera) |
| Shift | Run |
| Mouse | Turn the camera (click the view to lock the pointer) |
| E | Enter, sit down, start, talk to the clerk |
| Esc | Release the pointer and pause; stand up when seated; back to the café from the level list; back to the list from a level |

## Provisional content (first-pass placeholders)

Shop names, layout and text are placeholders the user hasn't confirmed:

- **Street**: bright daytime, an east–west two-lane road (driving on the left) with pavements. Three shops to enter on the north side; facades and street furniture on the south. Mostly red brick; double yellow lines, Belisha beacons at the zebra crossing, LOOK RIGHT at the kerb.
- **CYBERSPACE CAFÉ** (net café, centre): 12 computers in three rows. The entry computers sit side by side at the start of the front row: the XP machine (beige CRT), then the Mac (translucent iMac), opening the XP and Mac level lists; right behind each, in the middle row, sits that system's HackerEditor computer for making charts ([chart-editor.md](chart-editor.md)); the other seats are taken, out of order or switched off. Seated at an editor the card's button reads "Open" and shows no best score. The front desk is unattended, with a price list and notes.
- **MILLENNIUM RECORDS** (record shop, west): steel shelving, a boombox and tape deck on the counter.
- **FUNLAND AMUSEMENTS** (arcade, east): arcade cabinets, a dance machine, a TV-and-console demo stand. With the cheat code's 10p coin in hand, any arcade cabinet takes it and ends the cheat ([cheat-code.md](cheat-code.md)).
- Whether the record shop and arcade become entries to new scenes is open.
- **British and millennial details**:
  - Street: two banners across the road (WELCOME TO THE NEW MILLENNIUM · 2000, HIGH STREET MILLENNIUM FESTIVAL), an LED ticker on a south rooftop, two rooftop billboards (512K broadband, PC 2000), a CRT TV wall at the electrical shop, a red phone box, a red pillar box, a newsstand, a bus stop, a HIGH STREET sign, the hanging sign of THE MILLENNIUM ARMS pub.
  - South side shops: video rental, mobiles, one-hour photo, newsagent, fish and chips, computer superstore, bookies, off-licence; flyers on the shutters for PC builds, top-ups, polyphonic ringtones, Flash games, digital cameras and video rental, priced in pounds.
  - Inside: the café's "OPEN 7 DAYS" neon and Y2K READY / broadband posters, the arcade's "10p A GO" ticker, an old beige laptop on the café desk.
- **Atmosphere**: a gradient blue sky, pale pink-purple haze in the distance, drifting motes, slightly whitened edges.
- **Sound**: sitting at the XP computer plays the XP logon sound; at the iMac, the Mac startup chime.
- No passers-by in the café for now: the code-built figures weren't good enough and were removed until suitable models exist.

## Open questions

- [ ] Shop names and street layout
- [ ] Rating thresholds and scoring
- [ ] Character outfits (the model's credit is under "Credits" in the title menu)
- [ ] Unlocking and progression: how locked computers look
- [ ] Hub music and ambient sound
- [ ] Gamepad and touch controls
