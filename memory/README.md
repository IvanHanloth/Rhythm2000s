# Shared LLM memory

Project memory shared across sessions and AI assistants. It is committed with the repository, so every collaborator and assistant sees the same thing.

## What to record

- **user**: roles, preferences and habits of the user or team
- **feedback**: corrections or confirmations of how to work (e.g. "keep docs short"), with the reason
- **project**: goals, constraints and context in progress that the code and docs don't show. Always use absolute dates
- **reference**: pointers to external resources (links, boards, reference works)

## What not to record

- Anything you can read from the code, `doc/` or git history
- Details that only matter to one conversation
- Secrets, accounts and other sensitive data

## Format

One memory per file, named in kebab-case, e.g. `project-concept.md`:

```markdown
---
name: project-concept
description: One-line summary, used to judge whether the memory is relevant
metadata:
  type: user | feedback | project | reference
---

The memory. feedback / project memories add:
**Why:** the reason
**How to apply:** how to act on it

Link related memories with [[name]].
```

## Maintenance

1. After adding or changing a memory, add or update its line in [MEMORY.md](MEMORY.md): `- [Title](file.md) — one-line hook`.
2. Check for a similar memory first; update it rather than adding a duplicate.
3. Fix or delete memories that turn out to be stale or wrong, and update the index.
