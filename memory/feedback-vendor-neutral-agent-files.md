---
name: feedback-vendor-neutral-agent-files
description: 仓库里不要放 CLAUDE.md 和 .claude/，AI 助手的说明和技能只放 AGENTS.md 与 .agents/
metadata:
  type: feedback
---

2026-10-24 用户要求删除根目录 CLAUDE.md、整个 .claude/（含 PixiJS 技能副本和 launch.json）以及 promo/CLAUDE.md，只保留 AGENTS.md 和 .agents/skills。

**Why:** 用户希望项目对各家 AI 助手保持中立，不维护某一家专用的重复文件。
**How to apply:** 安装技能时只装到 .agents/skills（`skills add` 不要带 `-a claude-code`）；工具脚手架生成的 CLAUDE.md、.claude/ 一律删掉，不要提交。
