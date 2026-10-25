# assets

Assets shared by the game and the promo video (`promo/`): classic wallpapers, sounds, icons and fonts of Windows XP and Mac OS around 2000. `promo/assets` is a symlink to this folder, so videos reference `assets/...`.

## Layout

```
assets/
├── fonts/pp-neuebit/           # PP NeueBit Bold, PP Mondwest Regular (chosen by the user)
├── fonts/baloo-2/              # Baloo 2 ExtraBold (the logo's display face, src/theme/tokens.ts), Latin subset, for the promo
└── reference/                  # Original system assets, only the most representative
    ├── windows-xp/
    │   ├── wallpapers/         # 4K: Bliss, Azul, Autumn, Red moon desert, Ascent, Radiance, Follow, Tulips
    │   ├── sounds/             # 22: startup, shutdown, logon, logoff, error, notify, balloon, recycle, tada…
    │   ├── icons/              # 52: My Computer, Recycle Bin, folders, IE, Outlook Express, MSN, Minesweeper, dialog icons, tray speaker, Start flag…; plus 2 pointers (.cur)
    │   └── fonts/              # Tahoma (the XP UI font)
    ├── mac-os-x/               # The Aqua era, 10.0–10.4
    │   ├── wallpapers/default-6k/  # Default wallpapers of 10.0/10.1, 10.2, 10.3, 10.4 at 6K
    │   ├── wallpapers/aqua/    # Built-in Aqua set: Aqua Blue, Aqua Graphite, Flow, Water…
    │   ├── sounds/             # All 14 alert sounds: Basso, Funk, Glass, Sosumi…
    │   └── icons/              # 18 bundled 10.4 app icons: Safari, Mail, iTunes, iChat, Terminal… (256 px PNG)
    └── mac-os-classic/         # Mac OS 8/9
        ├── wallpapers/         # 9.2 desktop pictures: Mac OS Background, Convergence, the iMac colour series (8)
        ├── sounds/             # Classic alerts (Sosumi, Quack, Wild Eep…) and the Startup Chime
        └── fonts/              # Charcoal (the OS 8/9 UI font), Monaco
```

Original file names are kept; XP icons were extracted from system DLLs / EXEs at their highest resolution and renamed by use (except the RW Designer additions below).

## Sources

| Asset | Source |
| --- | --- |
| XP sounds | [archive.org: windowsxpstartup_201910](https://archive.org/details/windowsxpstartup_201910) |
| XP wallpapers 4K | [archive.org: windows-xp_202607](https://archive.org/details/windows-xp_202607) |
| XP icons | [archive.org: WindowsXPExtractedIcons](https://archive.org/details/WindowsXPExtractedIcons) |
| XP icon additions: `windows-logo.png` (flag only), `speaker.png`, `user.png`, `global.png`, `network-global.png`, `network-neighborhood.png`; pointers `default_arrow.cur`, `default_link.cur` | [RW Designer](https://www.rw-designer.com/) |
| Mac OS X default wallpapers 6K | [512 Pixels collection](https://512pixels.net/projects/default-mac-wallpapers-in-5k/) |
| Mac OS X Aqua wallpapers | [archive.org: mac-os-x-10.0-cheetah-desktop-pictures](https://archive.org/details/mac-os-x-10.0-cheetah-desktop-pictures), [mac-os-x-10.4-desktop-pictures](https://archive.org/details/mac-os-x-10.4-desktop-pictures) |
| Mac OS X alert sounds | [archive.org: mac-os-old-system-sounds](https://archive.org/details/mac-os-old-system-sounds) |
| Mac OS X app icons | [archive.org: mac-os-x-10.4-application-icons](https://archive.org/details/mac-os-x-10.4-application-icons) (.icns converted to PNG) |
| Mac OS 9 wallpapers | [archive.org: mac-os-9.2-desktop-pictures](https://archive.org/details/mac-os-9.2-desktop-pictures) |
| Classic Mac alert sounds | [archive.org: macos8_error_sounds](https://archive.org/details/macos8_error_sounds) |
| Classic Mac startup chime, Charcoal, Monaco, Tahoma | [archive.org: mac-os-9-linux](https://archive.org/details/mac-os-9-linux) |
| Baloo 2 ExtraBold (`fonts/baloo-2/`) | [Google Fonts](https://fonts.google.com/specimen/Baloo+2), Latin subset woff2; [SIL OFL 1.1](fonts/baloo-2/OFL.txt) |
| PP NeueBit / PP Mondwest | [befonts](https://befonts.com/mondwest-neuebit-font.html); publisher [Pangram Pangram](https://pangrampangram.com/products/neue-bit) |
| Whale girl 3D model (`public/models/whale-girl.glb`) | `whale-adult.glb` from [ai-girls-3d](https://github.com/ningfangtianwai-pixel/ai-girls-3d) v1.0.0 by Manny / ningfangtianwai-pixel, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changed: compressed with glTF-Transform 4.5 (`optimize --compress meshopt --texture-compress webp --texture-size 2048 --simplify-ratio 0.5 --simplify-error 0.0005`), 14.1 MB → 1.26 MB |
| Street PBR textures (`public/textures/<name>/`) | [Poly Haven](https://polyhaven.com/textures), [CC0](https://polyhaven.com/license): asphalt_02, square_concrete_pavers, rectangular_facade_tiles, red_brick_03, painted_plaster_wall, painted_metal_shutter, floor_tiles_06, dirty_carpet. 1K colour / normal (OpenGL) / roughness JPGs converted to WebP with cwebp (colour q78, normal q90, roughness q75) |
| Street prop models (`public/models/props/`) | [Poly Haven](https://polyhaven.com/models), CC0: street_lamp_01 / 02, metal_trash_can, utility_box_01, power_box_01, water_manhole_cover, plastic_monobloc_chair_01, plastic_crate_01, potted_plant_01, mounted_fluorescent_lights, ceiling_fan, steel_frame_shelves_01, cardboard_box_01, security_camera_01, boombox, cassette_player, portable_cassette_player, television_02, gaming_console, gamepad, classic_laptop. 1K glTF compressed with glTF-Transform 4.5 (`optimize --compress meshopt --texture-compress webp --texture-size 1024`) |
| Café monitor images (`public/textures/screens/`) | XP wallpapers from reference/ (Bliss, Azul, Autumn, Red moon desert) and Mac OS X 10.0 Aqua Blue, scaled to 512 px with sips and converted to WebP |

archive.org and RW Designer entries are user uploads; the files haven't been checked one by one against the originals.

## Licences and limits

- **reference/**: copyright Microsoft and Apple. The project is for academic use only, and the game and promo may use them directly ([ADR 0004](../doc/decisions/0004-authentic-os-look.md)).
- **Baloo 2**: SIL Open Font License 1.1, free to use, embed and ship, including commercially.
- **Poly Haven**: CC0, free to use and change, no credit needed.
- **Whale girl model**: CC BY 4.0, changes and commercial use allowed, but the game must credit the author, project and licence and note the changes. The character is DeepSeek fan art, not officially licensed.
- **PP NeueBit / PP Mondwest**: marked "Personal Use Only" by befonts. Releasing the game or publishing promo videos is commercial use; buy a licence from Pangram Pangram first.
