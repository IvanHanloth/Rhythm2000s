# 0005 A 3D street built with Three.js for the title screen and level select

- Status: Accepted
- Date: 2026-10-24

## Context

The game needs a title screen and level select. The user wanted level select as a small open world: after "Start", the player walks a 2000s street into a net café and sits at a computer to start a level. Everything so far is 2D PixiJS (ADR 0001, 0002). To decide: rendering, controls, scope and the title screen.

## Options

Rendering:

1. **Three.js 3D**: a new `three` dependency used only for the hub; levels stay in PixiJS. Costs a second renderer and switching between two canvases.
2. **PixiJS 2D / pseudo-3D**: no new dependency, but walking into a café and sitting down feels far less spatial.
3. **PixiJS side-scroller**: least work, least open.

Controls: fixed isometric view with WASD; third-person follow with mouse look; click-to-move.

## Decision

- **Rendering**: option 1, Three.js (`three`), only in `src/hub/`.
  - **Style: realistic models and materials with a bright, dreamcore mood.** PBR materials with photo textures, shadows that follow the character, ACES tone mapping, rendered at window resolution. Daytime under our own gradient sky (saturated blue to a pinkish-white horizon), which also provides the environment map; post-processing adds a dreamcore grade (more saturation, pastel shadows, whitened edges) and drifting motes. Bloom is reserved for emissives tuned above the threshold (crossing beacons, LED tickers, neon, level markers); three's physical sky and HDRIs are far brighter than 1 and flood the bloom, so neither is used. (The first low-poly, pixelated direction and a dusk version were both dropped at the user's request.)
  - **Setting: a British high street around 2000**: red brick, double yellow lines, a zebra crossing with Belisha beacons, a red phone box and pillar box, a net café, record shop, arcade, chippy and pub; prices in pounds.
  - **Assets**: generic textures and props from commercially usable sources (Poly Haven, CC0); period props made by the user in Tripo / Blender ([hub-assets.md](../hub-assets.md)), with simple placeholders until then. Code places, animates and lights; it no longer builds shapes as final art.
  - **Lead character**: the DeepSeek whale girl, a ready-made GLB (ai-girls-3d, CC BY 4.0), walked and seated by turning its bones in code.
  - Sign and poster text is still drawn on canvases, in English.
  - The hub fills the whole window, outside ADR 0002's 1280×720 stage: it isn't a PixiJS scene and needs no fixed logical coordinates.
- **Controls**: third-person follow with mouse look. WASD to move, Shift to run, mouse to turn (Pointer Lock), E to interact.
- **Scope**: one street with a few shops to enter. The café's computers are the level entries; the other shops are interiors only, as future scene entries.
- **Title screen**: the street as backdrop with the camera panning slowly and the title and menu on top; "Start" drops the camera behind the character seamlessly.
- **Time**: the hub judges no rhythm, so movement and camera use `requestAnimationFrame` time (with a capped step), not the audio clock. Anything added later that moves to the music follows the audio clock.

## Consequences

- New runtime dependency `three` and dev dependency `@types/three`. GLB loading, meshopt decoding and post-processing come from `three/examples`, with no other dependencies.
- Assets live in `assets/public/models/` and `assets/public/textures/`, with compression and sources in assets/README.md (about 13 MB now, growing with custom models); a loading bar shows under the title.
- The game opens on the street by default (`#street`); a scene id in the URL (e.g. `#windows-xp`) still opens that scene directly for development.
- Esc in a level entered from the café returns to the seat.
- Street layout, shops and level computers are provisional, see [hub.md](../hub.md).
