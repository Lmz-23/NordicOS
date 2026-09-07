---
name: install-tracked-drift
description: El array TRACKED de install.sh se desincroniza de los archivos reales del repo; verificarlo siempre antes de dar por reparados los symlinks
metadata:
  type: project
---

`install.sh` sólo enlaza lo que está listado explícitamente en `TRACKED`. En 2026-09-07 se detectó que `waybar/docker_status.sh`, `waybar/docker_toggle.sh` y `waybar/workspace_status.sh` existían en el repo y estaban referenciados por `waybar/config.jsonc`, pero faltaban en `TRACKED`, por lo que quedaban rotos aunque `install.sh` se ejecutara correctamente.

**Why:** los módulos nuevos de waybar se agregaron al repo sin actualizar la lista; el fallo es silencioso porque `link_file` hace `[skip]` de lo que no está listado y waybar degrada el módulo sin error visible.

**How to apply:** ante cualquier trabajo sobre `install.sh` o sobre symlinks rotos, contrastar el contenido real de `home/` contra `TRACKED` y contra las rutas que los configs invocan (`~/.config/waybar/*.sh`) antes de declarar la reparación completa. Ver [[wallpaper-boot-decision]].
