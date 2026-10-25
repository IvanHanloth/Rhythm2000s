---
name: project-promo-assets-junction-windows
description: On Windows without symlink rights, promo/assets checks out as a text file; replace it with a directory junction and skip-worktree it
metadata:
  type: project
---

`promo/assets` is a git symlink to `../assets`. On the user's Windows machine (2026-10-25) `core.symlinks` is false and creating symlinks needs admin rights, so the checkout is a 9-byte text file reading `../assets` and the HyperFrames preview can't find any media or fonts.

Fix that worked: delete the text file, run `cmd /c mklink /J promo\assets <repo>\assets` (a junction needs no admin), then `git update-index --skip-worktree promo/assets` so git stops reporting it as deleted.

**Why:** a junction behaves like the symlink for the preview server and renderer, but git can't store it, so without skip-worktree it shows as ` D promo/assets` and could be committed as a deletion.

**How to apply:** if `promo/assets` is a file rather than a folder, do the above before `npx hyperframes preview`. Never commit a change to `promo/assets`. To undo: `git update-index --no-skip-worktree promo/assets`, remove the junction, `git checkout -- promo/assets`.
