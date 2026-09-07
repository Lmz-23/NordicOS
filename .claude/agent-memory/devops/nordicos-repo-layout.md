---
name: nordicos-repo-layout
description: NordicOS dotfiles repo structure, install.sh mirroring convention, and atomic-write/backup style used across the project
metadata:
  type: project
---

NordicOS lives at `/home/lmz/Proyectos/nordicos` (moved from `/home/lmz/nordicos` around 2026-09-07). `install.sh` mirrors the repo's `home/` directory onto `$HOME` (as of the 2026-09-07 refactor: `SRC_ROOT="$SCRIPT_DIR/home"`, `DST_ROOT="$HOME"`, so `TRACKED` entries are full paths like `.config/waybar/...` or `.local/bin/...`, not just `.config`-relative anymore). Symlinks are created repo → `$HOME`, with automatic timestamped backup (`<dst>.bak-install-<ts>`) of any pre-existing regular file/dir at the destination.

Key conventions to preserve when touching `install.sh` or `palette/build.js`:
- Atomic writes: write to `<dst>.tmp` then `mv`/`rename` into place.
- Byte-for-byte comparison before writing — never touch mtime if content is unchanged (see `palette/build.js` `atomicWrite`/backup helpers for the reference style).
- `backups/` at repo root is gitignored (`backups/` + `!backups/.gitkeep` in `.gitignore`) and used for both `palette/build.js` config backups and `bin/quarantine-legacy.sh` quarantine drops.
- `bin/sync-tracking.sh` handles "hybrid" files that can't be symlinked (currently only `hypr/hyprland.lua`, pull/push between repo and `~/.config`). Its internal path assumptions must stay in sync with `SRC_ROOT`'s meaning in `install.sh`.
- `hyprpaper.service` is the vendor package unit (`/usr/lib/systemd/user/hyprpaper.service`), no `-c` flag, no `WorkingDirectory` — it can only read `~/.config/hypr/hyprpaper.conf` from the default path. Never edit that vendored unit; only ever write the conf file it reads.
- `templates/*.conf.in` + render logic in `install.sh` is the pattern for generating config files with `@PLACEHOLDER@` substitution (see `templates/hyprpaper.conf.in`), stamped with a `# NordicOS — archivo GENERADO...` marker line so install.sh can detect and safely back up hand-edited configs before overwriting.
- `bin/quarantine-legacy.sh` is the pattern for non-destructive cleanup: inventory-only by default, `--apply` moves matched junk (`*.bak`, `*.bak-*`, `*.disabled`, `*.broken`, `*.orig`) into `backups/quarantine-<timestamp>/` preserving relative path from `~/.config`, never touches symlinks (even broken ones).

See [[feedback-no-unilateral-commits]] for how the user wants git state left after this kind of large infra task.
