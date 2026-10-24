---
name: project-vitest-glob-cache
description: 新增 public/charts/*.json 后 vp test 可能还用旧的文件列表，要先删 node_modules/.vitest-cache
metadata:
  type: project
---

`src/game/chart-files.test.ts` 用 `import.meta.glob('/public/charts/*.json')` 列出谱面目录。2026-10-24 发现：新增谱面文件后，`vp test` 仍沿用 `node_modules/.vitest-cache` 里缓存的旧 glob 结果，报「清单列出的文件和目录不一致」，`--no-cache` 也不管用。删掉缓存目录后就正常了。

**Why:** Vitest 的模块缓存按测试文件内容判断是否失效，目录里多了文件不会让它失效。

**How to apply:** 新增或删除 `public/charts/` 下的文件后，如果 chart-files 测试报清单不一致，先 `rm -rf node_modules/.vitest-cache` 再跑一次，确认不是缓存问题再去改 index.json。
