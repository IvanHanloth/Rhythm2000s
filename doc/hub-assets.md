# Custom models for the street hub

> Status: Draft

The street's ([hub.md](hub.md)) realistic assets come in two kinds:

- **Stock**: photo textures for walls and ground and generic props (street lamps, bins, ceiling fans) from Poly Haven (CC0), listed in [assets/README.md](../assets/README.md).
- **Custom**: period-specific things that can't be found online, made by the user in Tripo / Blender. Simple placeholder shapes stand in until they exist.

## Adding a model

1. Export a GLB named `<slot>.glb` into `public/models/custom/`.
2. Add the slot to `manifest.json` in that folder: `{ "slots": ["crt-pc", "office-chair"] }`.
3. Reload; every use of the slot switches to the model. Slots missing from the manifest keep their placeholder.

Large files can be compressed with glTF-Transform (command in assets/README.md, on the whale girl line).

## Spec

| Item | Requirement |
| --- | --- |
| Units | Metres, modelled at real size; never scaled in game |
| Axes | Y up, front facing +Z (in Blender front faces -Y; export glTF with "+Y Up") |
| Origin | Centre of the base, on the ground (y = 0) |
| Triangles | Small props ≤ 5,000; large ones (arcade cabinets, newsstand) ≤ 20,000 |
| Textures | PBR metallic / roughness, each ≤ 2048 × 2048, embedded in the GLB |
| Screens | Make the screen a separate mesh named `SCREEN`; the game replaces it with the screen image and aims the camera at its centre |
| Text | Signs and stickers on models in English only |

No collision meshes: collision boxes come from code, sized like the placeholders. Tell me if a model differs much from the sizes below so I can adjust its collision and placement.

## Slots

Sizes are the placeholder's (width × height × depth, m); models should come close.

| Slot | Object | Size | Where | Notes |
| --- | --- | --- | --- | --- |
| `crt-pc` | Beige CRT monitor, keyboard and tower (one model) | about 0.56 × 0.5 × 0.6 above the desk; tower under the desk on the right | Café front row (XP) and spare seats | Origin at the **desk's** base centre, desk top at 0.77 m; screen mesh `SCREEN` |
| `imac-g3` | Translucent all-in-one (Bondi blue) and keyboard | 0.58 × 0.54 × 0.5 | Café back rows (Mac) | Origin as above; screen mesh `SCREEN` |
| `computer-desk` | Café computer desk | 2.0 × 0.77 × 0.8 | Café, 12 | Dividers are placed by code; leave them out |
| `office-chair` | Swivel chair | 0.5 × 1.1 × 0.5, seat at 0.5 | Café, 12 | Facing +Z the sitter faces -Z: **back rest on the +Z side** |
| `cafe-counter` | Café front desk | 2.6 × 1.05 × 0.8 | Right of the café door | An old laptop goes on top |
| `shop-counter` | Record shop counter | 3.0 × 1.0 × 0.7 | Back of the record shop | A tape deck and portable player go on top |
| `cd-rack` | Rack full of CDs, vinyl and tapes | about 0.6 × 2.0 × 2.2 | Record shop (steel shelves and boxes for now) | Not wired up yet; tell me when it exists |
| `arcade-cabinet` | Upright arcade cabinet | 0.9 × 2.2 × 0.8 | Arcade, 4 | Screen mesh `SCREEN` (for attract mode later) |
| `dance-machine` | Dance machine (pads and screen cabinet behind) | 1.6 × 2.2 × 2.0 | Arcade | Origin at the pad centre |
| `tv-stand` | Low TV cabinet | 0.5 × 0.55 × 1.2 (long side along Z) | Arcade demo stand | An old TV and console go on top |
| `newsstand` | British newsstand (papers and magazines, a headline board) | 2.2 × 2.4 × 1.4 | South pavement | Front +Z; turned 180° in game to face the road |
| `phone-box` | Red K6 phone box (TELEPHONE on top) | 1.0 × 2.5 × 1.0 | South pavement | As above |
| `pillar-box` | Red cylindrical pillar box | 0.6 × 1.5 × 0.6 | South pavement | As above |
| `belisha-beacon` | Belisha beacon (striped pole, yellow globe) | 0.2 × 2.7 × 0.2 | Both ends of the zebra crossing, 4 | Make the globe a mesh named `BEACON` (flashing not wired up yet; tell me when it exists) |
| `bus-stop` | British bus shelter (glass back, roof, stop sign) | 4.0 × 2.6 × 1.4 | South pavement | As above |

## Possibly later

Not in the first batch; check before making: shopfront fascias (code-built walls and light boxes now), passers-by, bicycles, cars (black cabs, red double-deckers), street trees, a pub front.
