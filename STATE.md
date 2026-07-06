# NordicOS — Estado del Proyecto

**Última actualización:** 2026-07-05
**Versión:** 0.1.0 (sistema de paleta centralizada en construcción)

## ¿Qué es NordicOS?

Setup de escritorio Linux con tema vikingo personalizado sobre Hyprland.
Estética: hierro, piedra, acero, hielo. NO minimalista tipo macOS, NO tema Nord genérico.

## Sistema de Paleta (NUEVO — Fases 0-4)

### Arquitectura
- `palette/master.css` — única fuente de verdad para colores
- `palette/build.js` — generador Node.js que escribe a todos los componentes
- `palette/watch.js` — watcher automático (chokidar)
- `palette/preview.html` — preview visual de la paleta actual

### Paleta canónica (11 colores)
| Token | Hex | Uso |
|---|---|---|
| bg | #0b0f14 | Fondo principal |
| surface | #151c24 | Paneles |
| surface-alt | #1a2332 | Superficie elevada |
| border | #3b556d | Bordes |
| accent | #78c7ff | Acento principal |
| accent-soft | #a0d4ff | Acento secundario |
| text | #d4dde3 | Texto principal |
| text-muted | #8a9bab | Texto secundario |
| success | #6fbf73 | Éxito |
| warning | #d89b3c | Advertencia |
| error | #b84c4c | Error |

### Flujo de trabajo
1. Editar `palette/master.css`
2. Guardar (watcher detecta → ejecuta build.js automáticamente)
3. Verificar `palette/preview.html` en navegador
4. Si todo OK, commit

## Componentes del sistema NordicOS

### ✅ Completados (previo a Fases 0-4)
- Waybar (configurado en `~/.config/waybar/`)
- Kitty (`~/.config/kitty/kitty.conf`)
- Wofi (`~/.config/wofi/`)

### ⏳ Pendientes
- Hyprlock
- Hyprpaper
- Conky (paneles laterales)
- Tema GTK global
- Tema de iconos vikingo
- Cursor theme

## Issues conocidos (a resolver en Fase 6)
- `~/.config/hypr/colors.css` está huérfano (nadie lo importa)
- `~/.config/hypr/hyprland.lua` tiene colores que NO respetan la paleta
- `~/.config/hypr/autostart.sh` invoca `swww-daemon` que no está instalado
- `~/.config/waybar/style-legacy.css` (329 líneas, código muerto)
- `~/.config/waybar/config.jsonc.bak` (backup obsoleto)
- `~/.config/waybar/power_menu.xml` (ignorado, se usa `.sh`)
- Directorios vacíos: `~/.config/waybar/modules/`, `~/.config/waybar/scripts/`

## Reglas del proyecto
1. Un componente a la vez — esperar confirmación antes de avanzar
2. Editar SOLO `palette/master.css` para cambiar colores (NUNCA los archivos generados)
3. Comentar código para poder modificar después
4. Informar ANTES de instalar paquetes
5. Cero código muerto — eliminar archivos no usados

## Comandos útiles
```bash
# Build manual (sin watcher)
npm run build

# Watcher automático
npm run watch

# Ver preview
npm run preview
```
