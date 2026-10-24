---
name: project-vitest-glob-cache
description: After adding public/charts/*.json, vp test may keep a stale file list; delete node_modules/.vitest-cache first
metadata:
  type: project
---

`src/game/chart-files.test.ts` lists the chart folder with `import.meta.glob('/public/charts/*.json')`. On 2026-10-24, after a new chart file was added, `vp test` kept the old glob result cached in `node_modules/.vitest-cache` and reported that the index and the folder disagree; `--no-cache` didn't help. Deleting the cache folder fixed it.

**Why:** Vitest invalidates its module cache by the test file's content; a new file in the folder doesn't invalidate it.

**How to apply:** after adding or removing files under `public/charts/`, if the chart-files test reports a mismatch, run `rm -rf node_modules/.vitest-cache` and try again before touching index.json.
