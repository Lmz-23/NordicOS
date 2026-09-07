# Análisis funcional: Reparación de symlinks tras mudanza del repo y aplicación inmediata de wallpaper al inicio

**Fecha:** 2026-09-07
**Etapa AIEOS:** Analysis
**Fuente:** Reporte del usuario + hallazgos verificados en vivo por `scout` (solo lectura)

---

## Objetivo

Restaurar completamente la configuración de escritorio de NordicOS (waybar, kitty, wofi, ags, fastfetch, systemd de wallpaper) tras el movimiento del repositorio de `/home/lmz/nordicos` a `/home/lmz/Proyectos/nordicos`, y garantizar que el wallpaper del pack de NordicOS se aplique de forma inmediata y confiable al iniciar sesión, sin depender de un timer que tarda hasta 30 segundos en dispararse por primera vez.

---

## Contexto

El repo NordicOS gestiona su configuración mediante symlinks creados por `install.sh` (idempotente, sin rutas hardcodeadas, usa `SCRIPT_DIR` dinámico) desde `home/.config/*` hacia `~/.config/*`. Tras mover el repo de ubicación, todos los symlinks `TRACKED` por `install.sh` quedaron apuntando a la ruta vieja inexistente (`/home/lmz/nordicos/...`), rompiendo waybar, kitty, wofi, ags y fastfetch (cada app cayó a su configuración por defecto embebida). Las units de systemd de `wallpaper-rotate` también quedaron rotas por la misma razón, impidiendo que systemd las cargue.

Independientemente de ese problema, ya existía un segundo defecto: el script `~/.local/bin/wallpaper-rotate.sh` —que vive fuera del repo y **no está gestionado por `install.sh`** (no aparece en el array `TRACKED`)— tiene hardcodeado `WALLPAPER_DIR="/home/lmz/nordicos/assets/wallpapers"`, una ruta que además de estar ahora rota por la mudanza, ya representaba un acoplamiento frágil a una ubicación fija del repo. Adicionalmente, el único mecanismo que aplica un wallpaper del pack es `wallpaper-rotate.timer` (`OnBootSec=30`), y no existe una configuración estática de `hyprpaper` (`hyprpaper.conf`) que precargue un wallpaper del pack inmediatamente al arrancar `hyprpaper.service`. Esto explica por qué el escritorio mostraba el fondo por defecto del sistema durante los primeros ~30 segundos tras cada inicio de sesión, incluso antes de que el repo se moviera.

Se confirmó además, revisando `~/.config` en vivo, la existencia de un volumen considerable de archivos `.bak*` y `.disabled` sueltos (waybar, ags, hypr, systemd, incluyendo un `.bak-install-20260717155127` generado por una corrida previa de `install.sh`), que podrían confundirse con configuración activa durante una reparación manual.

---

## Requerimientos Funcionales

**RF-1.** Todos los symlinks listados en `TRACKED` de `install.sh` (waybar, kitty, wofi, ags, fastfetch, systemd/user/wallpaper-rotate.{timer,service}, autostart/blueman.desktop) deben apuntar a rutas dentro de `/home/lmz/Proyectos/nordicos/home/.config/...` (la ubicación actual del repo) y resolver correctamente (no estar rotos).

**RF-2.** Tras la reparación, cada aplicación afectada (waybar, kitty, wofi, ags, fastfetch) debe cargar la configuración de NordicOS —no la configuración por defecto embebida— sin requerir edición manual de cada app.

**RF-3.** Las units `wallpaper-rotate.timer` y `wallpaper-rotate.service` deben poder ser cargadas y activadas por `systemd --user` sin error `Unit ... could not be found`.

**RF-4.** El script que realiza la rotación/aplicación de wallpapers (actualmente `~/.local/bin/wallpaper-rotate.sh`) debe poder localizar el directorio de wallpapers del pack (`assets/wallpapers/`) sin depender de una ruta absoluta hardcodeada que asuma una ubicación fija del repo.

**RF-5.** Al iniciar sesión (arranque de `hyprpaper.service` / sesión de Hyprland), debe aplicarse un wallpaper del pack de NordicOS de forma inmediata, sin que el usuario perciba el fondo por defecto del sistema durante ningún intervalo de espera (actualmente hasta 30s por `OnBootSec=30` del timer).

**RF-6.** La reparación no debe depender de que el usuario recuerde manualmente qué re-ejecutar; debe quedar claro (documentado o automatizado) qué pasos son necesarios tras un movimiento futuro del repo (ej. re-ejecutar `install.sh`, recargar servicios).

---

## Requerimientos No Funcionales

**RNF-1.** La solución debe preservar la idempotencia y la ausencia de rutas hardcodeadas que ya caracteriza a `install.sh` — cualquier cambio no debe introducir una nueva ruta absoluta fija en ningún artefacto gestionado por el repo.

**RNF-2.** La reparación debe ser reproducible: si el repo se vuelve a mover en el futuro, el mismo procedimiento (ej. re-ejecutar `install.sh`) debe bastar para restaurar el sistema, sin pasos manuales adicionales específicos de la nueva ubicación.

**RNF-3.** El mecanismo de aplicación inmediata de wallpaper al inicio no debe introducir una dependencia de temporización fragil equivalente a la actual (ej. reemplazar "esperar 30s" por otro retraso arbitrario que dependa del orden de arranque de servicios).

---

## Restricciones

**R-1.** `wallpaper-rotate.sh` actualmente vive fuera del árbol versionado del repo (`~/.local/bin`, no gestionado por `install.sh`). Cualquier reparación debe, como mínimo, eliminar la ruta absoluta hardcodeada; adicionalmente, considerar si el script debe pasar a ser un artefacto `TRACKED` gestionado por `install.sh` (versionado dentro del repo, symlinkeado igual que los demás archivos) para evitar que este problema se repita ante una futura mudanza. **Esto requiere decisión del usuario (ver Ambigüedades).**

**R-2.** Las units de systemd (`wallpaper-rotate.timer`, `wallpaper-rotate.service`) ya están `TRACKED` en `install.sh` y se reparan automáticamente al re-symlinkear, pero su contenido (`ExecStart=%h/.local/bin/wallpaper-rotate.sh`) sigue apuntando a un script externo cuyo contenido interno tiene la ruta hardcodeada — la reparación de las units por sí sola no resuelve el problema de fondo del wallpaper.

**R-3.** No se debe modificar la lógica de negocio de la rotación de wallpapers (orden, intervalo de 20 min, selección circular, aplicación a todos los monitores) — el alcance de esta reparación es exclusivamente symlinks rotos y ruta hardcodeada / timing de aplicación inicial, no un rediseño del mecanismo de rotación.

**R-4.** `install.sh` no debe recibir rutas hardcodeadas propias de la ubicación actual del repo; cualquier cambio a `install.sh` debe seguir derivando `SCRIPT_DIR` dinámicamente.

---

## Dependencias

**D-1.** `install.sh` (existente, idempotente) — mecanismo primario para re-crear los symlinks `TRACKED`.

**D-2.** `hyprpaper` (binario y `hyprpaper.service` del paquete, sin `hyprpaper.conf` propio en el repo actualmente) — responsable de aplicar wallpapers vía IPC.

**D-3.** `systemd --user` (`wallpaper-rotate.timer`/`.service`) — mecanismo de rotación periódica.

**D-4.** `~/.local/bin/wallpaper-rotate.sh` — script no versionado que ejecuta la rotación real.

**D-5.** `assets/wallpapers/` dentro del repo — pack de 10 wallpapers (`atadura.png`, `bote.png`, `cuervo.png`, `fiord.png`, `guerra.png`, `monolito.png`, `odin.png`, `ragnarok.png`, `thorvsjogg.png`, `tyr&fenrir.png`), confirmado presente en la ubicación actual del repo.

---

## Riesgos Funcionales

**RG-1 (confirmado).** Existe un volumen considerable de archivos `.bak*` y `.disabled` sueltos en `~/.config/waybar`, `~/.config/ags`, `~/.config/hypr`, `~/.config/systemd/user` y otros directorios (más de 40 archivos detectados, incluyendo un `.bak-install-*` generado por una corrida previa de `install.sh` y `waybar/media.sh.disabled`). Riesgo de que, durante una reparación manual o una futura ejecución de `install.sh`, se confunda un backup viejo con la configuración activa, o que estos archivos generen ruido al diagnosticar problemas futuros.

**RG-2.** Tras reparar los symlinks, es probable que se requiera reiniciar/recargar servicios (waybar, ags, systemd --user daemon-reload, hyprctl reload) para que los cambios surtan efecto sin necesidad de cerrar sesión completamente. Si este paso no se ejecuta o no se documenta, el usuario podría concluir erróneamente que la reparación no funcionó.

**RG-3.** Si `wallpaper-rotate.sh` pasa a ser gestionado por `install.sh` (ver R-1), existe riesgo de que la ruta de origen (dentro del repo) y el mecanismo de invocación (`ExecStart=%h/.local/bin/...` en la unit de systemd) queden desincronizados si no se actualiza también el contenido de la unit — cualquier decisión sobre R-1 debe considerar el impacto en D-3.

**RG-4.** Cualquier mecanismo nuevo para aplicar el wallpaper inmediatamente al inicio (ej. disparar la rotación como parte del arranque de `hyprpaper.service` en vez de depender del timer) debe garantizar que `hyprpaper` ya esté completamente inicializado antes de invocar la IPC (`hyprctl hyprpaper wallpaper ...`); de lo contrario se introduce una nueva condición de carrera equivalente al problema original.

---

## Ambigüedades Detectadas

**A-1.** ¿El usuario quiere que `wallpaper-rotate.sh` pase a vivir dentro del repo (versionado, gestionado por `install.sh` como los demás archivos `TRACKED`) en vez de permanecer standalone en `~/.local/bin`? Esta decisión determina si el alcance de la reparación incluye mover/versionar el script o únicamente corregir la ruta hardcodeada en su ubicación actual.

**A-2.** ¿Cómo debe resolverse la ruta al directorio de wallpapers dentro del script si deja de estar hardcodeada? El usuario mencionó posibles opciones (ruta derivada, variable de entorno, gestión vía `install.sh`) pero no indicó preferencia. Esta es una decisión técnica que corresponde a la etapa de Architecture, no a este análisis, pero se documenta aquí porque condiciona el alcance funcional (ej. si se requiere que `install.sh` inyecte una variable de entorno o genere el script desde una plantilla).

**A-3.** ¿El usuario prefiere que el wallpaper inicial se aplique mediante un `hyprpaper.conf` con `preload`/wallpaper estático, o mediante una modificación del orden/disparo de arranque para que el script de rotación se ejecute inmediatamente al iniciar `hyprpaper.service` (sin el `OnBootSec=30` del timer)? Ambas opciones tienen implicaciones de diseño distintas (una fija el primer wallpaper siempre igual; la otra mantiene la rotación pero la adelanta) que deben decidirse en Architecture, no en Analysis — se señala aquí como bloqueo de diseño pendiente.

**A-4.** ¿Debe limpiarse/archivarse el conjunto de archivos `.bak*`/`.disabled` detectados en `~/.config` como parte de este trabajo, o queda fuera de alcance y solo se documenta su existencia como advertencia? No se recibió instrucción explícita al respecto.

**A-5.** No se especificó si la reparación debe incluir reinicio de sesión completo (logout/login) como parte de la validación, o si basta con recargar servicios individuales (`systemctl --user daemon-reload`, `hyprctl reload`, `systemctl --user reload waybar`). Esto afecta el criterio de aceptación de RF-2 y RF-5.

---

## Priorización (MoSCoW)

- **Must:** RF-1, RF-2, RF-3 (restaurar symlinks y carga de configuración de todas las apps) — es la interrupción funcional más grave reportada.
- **Must:** RF-4, RF-5 (eliminar ruta hardcodeada y garantizar aplicación inmediata del wallpaper) — segundo defecto reportado, ya presente antes de la mudanza.
- **Should:** RF-6 (documentar/asegurar reproducibilidad ante futuras mudanzas) — evita reincidencia.
- **Should:** Resolver A-1 y A-2 antes de pasar a Architecture, ya que condicionan el diseño de la solución para RF-4.
- **Could:** Limpieza o archivado de los `.bak*`/`.disabled` sueltos (A-4) — no bloquea la funcionalidad pero reduce riesgo de confusión futura.
- **Won't (fuera de alcance de este análisis):** Rediseño de la lógica de rotación de wallpapers (orden, intervalo, selección) — ver R-3.

---

## Resultado

El problema reportado se descompone en dos defectos independientes pero relacionados: (1) symlinks rotos por la ruta hardcodeada implícita en la ubicación anterior del repo, afectando toda la configuración `TRACKED` por `install.sh`, con reparación esperada mediante re-ejecución de `install.sh` (mecanismo ya idempotente y sin rutas propias hardcodeadas); y (2) un script no versionado (`wallpaper-rotate.sh`) con ruta absoluta hardcodeada y ausencia de un mecanismo de aplicación inmediata de wallpaper al arranque, defecto preexistente a la mudanza.

Antes de avanzar a Architecture, es necesario que el Orquestador (o el usuario directamente) resuelva las ambigüedades A-1, A-2 y A-3, ya que determinan el alcance y diseño de la solución para RF-4 y RF-5: si `wallpaper-rotate.sh` se versiona dentro del repo, cómo se resuelve la ruta de wallpapers sin hardcodear, y si el wallpaper inicial se logra vía `hyprpaper.conf` estático o vía disparo inmediato del script de rotación. El riesgo RG-1 (archivos `.bak*`/`.disabled` sueltos, confirmado en `~/.config`) debe tenerse en cuenta durante la implementación aunque su limpieza (A-4) sea opcional según decisión del usuario.

Este análisis no incluye diseño de solución, elección de mecanismo técnico (systemd unit vs. hook de Hyprland vs. `hyprpaper.conf`) ni modificación de código — corresponde a la etapa de Architecture definir cómo satisfacer estos requerimientos.
