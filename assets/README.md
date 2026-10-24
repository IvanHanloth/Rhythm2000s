# assets

游戏和宣发视频（`promo/`）共用的素材：2000 年前后 Windows XP 与 Mac OS 的经典壁纸、音效、图标、字体。`promo/assets` 是指向本目录的符号链接，视频里用 `assets/...` 引用。

## 目录

```
assets/
├── fonts/pp-neuebit/           # PP NeueBit Bold、PP Mondwest Regular（用户指定字体）
└── reference/                  # 原版系统素材，只保留最有代表性的
    ├── windows-xp/
    │   ├── wallpapers/         # 4K：Bliss、Azul、Autumn、Red moon desert、Ascent、Radiance、Follow、Tulips
    │   ├── sounds/             # 开机、关机、登录、注销、错误、提示、气泡、回收站、tada 等 22 个
    │   ├── icons/              # 我的电脑、回收站、文件夹、IE、Outlook Express、MSN、扫雷、错误/警告对话框、托盘小喇叭、开始按钮旗帜等 52 个，另有 2 个鼠标指针（.cur）
    │   └── fonts/              # Tahoma（XP 界面字体）
    ├── mac-os-x/               # Aqua 时代，10.0–10.4
    │   ├── wallpapers/default-6k/  # 10.0/10.1、10.2、10.3、10.4 默认壁纸 6K 版
    │   ├── wallpapers/aqua/    # 系统自带的 Aqua 系列：Aqua Blue、Aqua Graphite、Flow、Water 等
    │   ├── sounds/             # 提示音全套 14 个：Basso、Funk、Glass、Sosumi 等
    │   └── icons/              # 10.4 自带应用图标 18 个：Safari、Mail、iTunes、iChat、Terminal 等（256px PNG）
    └── mac-os-classic/         # Mac OS 8/9
        ├── wallpapers/         # 9.2 桌面图片：Mac OS Background、Convergence、iMac 配色系列 8 张
        ├── sounds/             # 经典提示音 Sosumi、Quack、Wild Eep 等 + 开机音 Startup Chime
        └── fonts/              # Charcoal（OS 8/9 界面字体）、Monaco
```

文件名保留原名；XP 图标是从系统 DLL / EXE 提取后挑出最高分辨率的一张，按用途重命名（RW Designer 补充的几个除外，见下表）。

## 来源

| 素材 | 来源 |
| --- | --- |
| XP 音效 | [archive.org: windowsxpstartup_201910](https://archive.org/details/windowsxpstartup_201910) |
| XP 壁纸 4K | [archive.org: windows-xp_202607](https://archive.org/details/windows-xp_202607) |
| XP 图标 | [archive.org: WindowsXPExtractedIcons](https://archive.org/details/WindowsXPExtractedIcons) |
| XP 图标补充：`windows-logo.png`（2026-10-24 换成只有旗帜的版本）、`speaker.png`、`user.png`、`global.png`、`network-global.png`、`network-neighborhood.png`；鼠标指针 `default_arrow.cur`、`default_link.cur` | [RW Designer](https://www.rw-designer.com/) |
| Mac OS X 默认壁纸 6K | [512 Pixels Mac 壁纸合集](https://512pixels.net/projects/default-mac-wallpapers-in-5k/) |
| Mac OS X Aqua 壁纸 | [archive.org: mac-os-x-10.0-cheetah-desktop-pictures](https://archive.org/details/mac-os-x-10.0-cheetah-desktop-pictures)、[mac-os-x-10.4-desktop-pictures](https://archive.org/details/mac-os-x-10.4-desktop-pictures) |
| Mac OS X 提示音 | [archive.org: mac-os-old-system-sounds](https://archive.org/details/mac-os-old-system-sounds) |
| Mac OS X 应用图标 | [archive.org: mac-os-x-10.4-application-icons](https://archive.org/details/mac-os-x-10.4-application-icons)（原为 .icns，转成了 PNG） |
| Mac OS 9 壁纸 | [archive.org: mac-os-9.2-desktop-pictures](https://archive.org/details/mac-os-9.2-desktop-pictures) |
| 经典 Mac 提示音 | [archive.org: macos8_error_sounds](https://archive.org/details/macos8_error_sounds) |
| 经典 Mac 开机音、Charcoal、Monaco、Tahoma | [archive.org: mac-os-9-linux](https://archive.org/details/mac-os-9-linux) |
| PP NeueBit / PP Mondwest | [befonts](https://befonts.com/mondwest-neuebit-font.html)，官方出品方 [Pangram Pangram](https://pangrampangram.com/products/neue-bit) |

archive.org 和 RW Designer 上的条目都是网友上传的，文件是否原样未经逐一核对。

## 授权与用途限制

- **reference/**：版权属于微软、苹果。项目仅作学术用途，游戏和宣发视频可以直接使用（见 [ADR 0004](../doc/decisions/0004-界面贴近原版.md)）。
- **PP NeueBit / PP Mondwest**：befonts 标注「Personal Use Only」。游戏发行和公开发布的宣发视频属于商用，正式使用前要从 Pangram Pangram 官网购买授权。
