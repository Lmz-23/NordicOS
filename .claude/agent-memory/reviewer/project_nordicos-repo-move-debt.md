---
name: nordicos-repo-move-debt
description: Deuda residual de rutas al viejo path /home/lmz/nordicos que quedó fuera de alcance en la reparación post-mudanza del 2026-09-07
metadata:
  type: project
---

El repo se movió de `/home/lmz/nordicos` a `/home/lmz/Proyectos/nordicos` (~2026-09-07). La reparación de ese ciclo cubrió `install.sh`, `wallpaper-rotate.sh`, `hyprpaper.conf` y las units systemd, pero **dejó fuera de alcance** las rutas viejas embebidas en `palette/build.js` (cabeceras de archivos generados), `STATE.md` y `palette/README.md`.

**Why:** Son solo comentarios en artefactos generados y documentación; no afectan el funcionamiento. Se decidió no ampliar el alcance del ciclo para no mezclar cambios no pedidos con la reparación.

**How to apply:** Si en un ciclo futuro aparecen esas rutas en un diff, trátalas como remediación legítima de deuda conocida, no como cambio fuera de alcance. Si NO aparecen, no las conviertas en motivo de rechazo de un entregable que no las tocaba.

Ver [[verify-implementer-evidence]].
