# assets

游戏和宣发视频（`promo/`）共用的素材。目前收集的都是 2000 年前后 Windows XP 与 Mac OS 的视觉、声音参考。

**本目录下除本说明和下载脚本外，其余文件都不进 git**：原版系统素材的版权属于微软、苹果，字体只有个人使用授权，而本仓库是公开的。规则见 [AGENTS.md「素材与版权」](../AGENTS.md#素材与版权)。

## 目录

| 路径 | 内容 | 授权 | 是否提交 |
| --- | --- | --- | --- |
| `reference/` | 原版系统素材，运行 `bash assets/fetch-reference.sh` 下载 | 微软 / 苹果所有 | 否 |
| `fonts/pp-neuebit/` | PP NeueBit Bold、PP Mondwest Regular | 仅限个人使用 | 否 |

### reference/ 的内容与来源

| 路径 | 内容 | 来源 |
| --- | --- | --- |
| `windows-xp/sounds/` | XP 系统音效 39 个（开机、关机、登录、提示、气泡等） | [archive.org: windowsxpstartup_201910](https://archive.org/details/windowsxpstartup_201910) |
| `windows-xp/wallpapers-4k/` | XP 默认壁纸的 4K 版（Bliss、Azul、Autumn 等） | [archive.org: windows-xp_202607](https://archive.org/details/windows-xp_202607) |
| `windows-xp/icons/` | 从 XP 系统文件提取的图标（PNG） | [archive.org: WindowsXPExtractedIcons](https://archive.org/details/WindowsXPExtractedIcons) |
| `mac-os-x/wallpapers-6k/` | Mac OS X 10.0–10.4 默认壁纸 6K 版 | [512 Pixels Mac 壁纸合集](https://512pixels.net/projects/default-mac-wallpapers-in-5k/) |
| `mac-os-x/sounds/` | Big Sur 之前的系统提示音（Basso、Funk、Glass 等） | [archive.org: mac-os-old-system-sounds](https://archive.org/details/mac-os-old-system-sounds) |
| `mac-os-classic/sounds/` | 经典 Mac OS 提示音（Sosumi、Quack、Wild Eep 等） | [archive.org: macos8_error_sounds](https://archive.org/details/macos8_error_sounds) |

archive.org 上的条目是网友上传的，文件是否原样未经核对。Mac 开机音（startup chime）暂未找到可靠来源。

## 用途限制

- **reference/**：只用来对照风格、节奏和音色，自己做原创版本时参考。不要放进游戏，也不要直接用在公开发布的宣发视频里。
- **PP NeueBit / PP Mondwest**：Pangram Pangram 出品的像素字体，下载来源 [befonts](https://befonts.com/mondwest-neuebit-font.html) 标注「Personal Use Only」。本地做样片可以用；游戏发行或公开发布的宣发视频属于商用，需要先从 [Pangram Pangram 官网](https://pangrampangram.com/products/neue-bit) 购买授权。

## 本地准备

```bash
bash assets/fetch-reference.sh   # 下载 reference/，已下载的会跳过
```

字体需要手动下载：打开上面的 befonts 页面下载压缩包，把其中的 `.otf` 解压到 `assets/fonts/pp-neuebit/`。
