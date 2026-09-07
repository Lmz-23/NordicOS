---
name: feedback-no-unilateral-commits
description: User explicitly wants git working tree left uncommitted after large infra/devops tasks in NordicOS, for their own review or the reviewer agent
metadata:
  type: feedback
---

Do not create git commits after completing devops implementation tasks in NordicOS, even large multi-file ones, unless explicitly asked to commit.

Why: task instructions for a symlink/wallpaper repair (2026-09-07) explicitly said "recomiendo NO hacer commit tú mismo — deja el working tree con los cambios para revisión posterior vía `git`/`reviewer`." This reflects a general preference in this project to review infra diffs before they're committed, consistent with the AIEOS pipeline's Review stage owning that gate.

How to apply: after finishing implementation work (install.sh changes, new scripts, generated configs, etc.), leave the working tree with unstaged/uncommitted changes and report a summary — do not run `git add`/`git commit` unless the user's message explicitly requests it for that specific task. See [[nordicos-repo-layout]] for the kind of work this applies to.
