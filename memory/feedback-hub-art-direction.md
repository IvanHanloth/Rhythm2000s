---
name: feedback-hub-art-direction
description: Art direction for the 3D street hub (2026-10-24): no blocky figures or crude code-built shapes, realistic scenery, English only in the world, the DeepSeek whale girl as lead
metadata:
  type: feedback
---

After the first version of the 3D street on 2026-10-24 the user asked, in turn:
- Blocky figures are "too ugly", and so is the rounded code-built chibi puppet; the lead should be the DeepSeek whale girl, and the user asked me to find a ready-made model online → the ai-girls-3d GLB (CC BY 4.0) was adopted.
- Realistic modelling, not PS1-style low-poly pixel art (overturning the low-poly direction in ADR 0005).
- Realistic but not gloomy: the dusk version was "too GTA, too dark"; they wanted "Genshin's brightness and a dreamcore feel" → daytime, a saturated gradient sky, pastel grading and drifting motes. Bloom only on emissives tuned for it, or the frame washes out white.
- "Stop drawing with SVG": no more code-painted textures or primitive-built geometry as final art; models we can't source are made by the user in Blender or Tripo.
- No Chinese in the 3D world (signs, posters, screens); all DOM overlays are English too (see [[feedback-english-everywhere]]).

**Why:** the user holds the visuals to a high standard that code-generated shapes can't reach.
**How to apply:** prefer ready-made assets cleared for commercial use (CC0 / CC BY; ask before downloading and register them in assets/README.md) or models from the user; code only places, animates, wires interaction and sets up rendering. When a custom model is needed, give the user a spec (size, origin, facing, naming) to build it from. Related: [[project-concept]]
