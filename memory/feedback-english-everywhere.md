---
name: feedback-english-everywhere
description: Since 2026-10-24 everything in the repository is English — player-facing text, code comments, error messages, tests, docs, memory and commit messages
metadata:
  type: feedback
---

On 2026-10-24 the user first made all player-visible text English, then asked for everything else to switch too: code comments, error messages, test names, docs under doc/, AGENTS.md, memory/ and commit messages. Earlier rules that kept comments and docs in Chinese are gone.

**Why:** the project is a UK hackathon entry ([[project-uk-hackathon]]) and the repository should read consistently to everyone; a half-translated codebase was the result of mixing the two rules.

**How to apply:** write new comments, docs, memories and commit messages in English. Replies to the user in chat can still be in Chinese. Don't record "decided on <date> by the user" history in code comments; put lasting decisions in doc/ or an ADR.
