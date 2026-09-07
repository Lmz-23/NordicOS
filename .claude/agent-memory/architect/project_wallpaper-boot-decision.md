---
name: wallpaper-boot-decision
description: Decisión de arquitectura 2026-09-07 sobre wallpaper al inicio y gestión de wallpaper-rotate.sh tras mover el repo a /home/lmz/Proyectos/nordicos
metadata:
  type: project
---

El wallpaper inicial de sesión se aplica con un `hyprpaper.conf` estático generado por `install.sh` (preload + `wallpaper = ,<ruta>` para todos los monitores), NO disparando el script de rotación al boot. `wallpaper-rotate.sh` pasa a vivir versionado dentro del repo (mirror de `$HOME`) y se symlinkea a `~/.local/bin/wallpaper-rotate.sh`; resuelve `assets/wallpapers/` por búsqueda ascendente de marcador desde `readlink -f "$0"`, nunca por ruta absoluta.

**Why:** el usuario decidió A-1(b)/A-2/A-3(a)/A-4 del análisis en `docs/requirements/reparacion-symlinks-y-wallpaper-post-mudanza.md`. La opción de disparar la rotación al arranque reintroducía una carrera con la inicialización de hyprpaper (RG-4) y una dependencia de temporización frágil (RNF-3); `hyprpaper` aplicando su propia conf elimina el orden de arranque de la ecuación. El script versionado evita que una futura mudanza vuelva a romperlo (RNF-2).

**How to apply:** al proponer cambios de wallpaper/arranque en este repo, no reintroducir disparos por timer/`exec-once` para el fondo inicial ni rutas absolutas al repo en ningún artefacto. La lógica de rotación (orden alfabético, circular, 20 min, todos los monitores) es intocable por R-3.
