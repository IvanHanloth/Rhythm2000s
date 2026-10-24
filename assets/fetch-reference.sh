#!/usr/bin/env bash
# 下载 Windows XP / 早期 Mac OS X 的原版素材到 assets/reference/，仅作本地参考。
# 这些素材版权归微软、苹果所有，reference/ 已被 .gitignore 忽略，不要提交，
# 也不要直接用进游戏或公开发布的宣发视频。来源与用途说明见 assets/README.md。
#
# 用法：bash assets/fetch-reference.sh   （已下载的文件会跳过，可重复运行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)/reference"
IA="https://archive.org/download"

# fetch <url> <目标文件>
fetch() {
  if [[ -s "$2" ]]; then return; fi
  mkdir -p "$(dirname "$2")"
  echo "下载 $2"
  curl -fL --retry 3 -o "$2.part" "$1"
  mv "$2.part" "$2"
}

# unpack <zip> <目标目录>：解压到独立目录，解压过就跳过
unpack() {
  if [[ -d "$2" ]]; then return; fi
  mkdir -p "$2"
  unzip -q "$1" -d "$2" -x '__MACOSX/*' '*/.DS_Store'
}

# archive_item <archive.org 条目> <目标目录> <文件扩展名>：下载条目中该扩展名的全部原始文件
archive_item() {
  curl -fsL "https://archive.org/metadata/$1" |
    python3 -c '
import json, sys
ext = sys.argv[1]
for f in json.load(sys.stdin)["files"]:
    if f.get("source") == "original" and f["name"].lower().endswith(ext):
        print(f["name"])
' "$3" |
    while IFS= read -r name; do
      fetch "$IA/$1/$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$name")" "$2/$name"
    done
}

# ---------- Windows XP ----------
# 系统音效（开机、关机、登录、提示音等 39 个 wav）
archive_item windowsxpstartup_201910 "$ROOT/windows-xp/sounds" .wav
# 默认壁纸的 4K 重制版（Bliss、Azul、Autumn 等）
fetch "$IA/windows-xp_202607/Windows%20XP.zip" "$ROOT/_downloads/windows-xp-wallpapers-4k.zip"
unpack "$ROOT/_downloads/windows-xp-wallpapers-4k.zip" "$ROOT/windows-xp/wallpapers-4k"
# 从系统文件中提取的图标（PNG）
fetch "$IA/WindowsXPExtractedIcons/Windows%20Icons%20-%20PNG.zip" "$ROOT/_downloads/windows-xp-icons-png.zip"
unpack "$ROOT/_downloads/windows-xp-icons-png.zip" "$ROOT/windows-xp/icons"

# ---------- Mac OS X Aqua 时代（10.0–10.4） ----------
# 默认壁纸 6K 版，来自 512 Pixels 的 Mac 壁纸合集
for v in 10-0_10-1 10-2 10-3 10-4; do
  fetch "https://media.512pixels.net/downloads/macos-wallpapers-6k/$v-6k.jpg" "$ROOT/mac-os-x/wallpapers-6k/$v-6k.jpg"
done
# Big Sur 之前的系统提示音（Basso、Funk、Glass、Sosumi 等）
fetch "$IA/mac-os-old-system-sounds/macOS%20Old%20Sounds.zip" "$ROOT/_downloads/mac-os-x-sounds.zip"
unpack "$ROOT/_downloads/mac-os-x-sounds.zip" "$ROOT/mac-os-x/sounds"

# ---------- 经典 Mac OS（7–9） ----------
# 经典提示音（Sosumi、Quack、Wild Eep、Droplet、Indigo）
archive_item macos8_error_sounds "$ROOT/mac-os-classic/sounds" .wav

echo "完成：$ROOT"
