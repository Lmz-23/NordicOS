---
name: project-nordicos-install-sh
description: install.sh in NordicOS is a full $HOME mirror (not just ~/.config), derives SCRIPT_DIR dynamically, and also renders hyprpaper.conf from a template + reconciles systemd units
metadata:
  type: project
---

As of 2026-09-07, `install.sh` in NordicOS (`/home/lmz/Proyectos/nordicos/install.sh`) does more than symlink `~/.config`:

- `SRC_ROOT="$SCRIPT_DIR/home"`, `DST_ROOT="$HOME"` — mirrors the entire `home/` tree in the repo onto `$HOME`, not just `.config/`. This is what let `home/.local/bin/wallpaper-rotate.sh` become a tracked/symlinked file.
- `SCRIPT_DIR` is derived dynamically (`$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)`), so the repo can be cloned/moved to any path and re-running `install.sh` is the full recovery procedure. This property is what fixed a real incident where the repo moved from `/home/lmz/nordicos` to `/home/lmz/Proyectos/nordicos` and broke all symlinks.
- After symlinking, it renders `templates/hyprpaper.conf.in` → `~/.config/hypr/hyprpaper.conf` via `sed` substitution of `@WALLPAPER_DIR@`/`@BOOT_WALLPAPER@` placeholders — a 4th generation strategy distinct from the 3 palette/build.js strategies (full replacement, include, marker-block splice) documented in README's "Arquitectura" section.
- At the end it does a defensive `systemctl --user daemon-reload` + `enable` of `hyprpaper.service` and `wallpaper-rotate.timer` (non-fatal if systemd unavailable).

**Why:** relevant background for `docs/requirements/reparacion-symlinks-y-wallpaper-post-mudanza.md`, the analysis doc behind these changes (dated 2026-09-07).

**How to apply:** when documenting install.sh behavior, verify against the live script rather than trusting older README/STATE.md snapshots — this script evolves. Companion script `bin/quarantine-legacy.sh` archives (never deletes) stray `.bak*`/`.disabled`/`.broken`/`.orig` files from `~/.config` into `backups/quarantine-<timestamp>/`.

Related: [[project-nordicos-docs-structure]]
