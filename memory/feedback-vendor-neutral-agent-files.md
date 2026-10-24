---
name: feedback-vendor-neutral-agent-files
description: No CLAUDE.md or .claude/ in the repository; assistant instructions and skills live only in AGENTS.md and .agents/
metadata:
  type: feedback
---

On 2026-10-24 the user had the root CLAUDE.md, the whole .claude/ (including a PixiJS skill copy and launch.json) and promo/CLAUDE.md deleted, keeping only AGENTS.md and .agents/skills.

**Why:** the project stays neutral across AI assistants and keeps no vendor-specific duplicates.
**How to apply:** install skills into .agents/skills only (`skills add` without `-a claude-code`); delete any CLAUDE.md or .claude/ that tooling generates instead of committing it.
