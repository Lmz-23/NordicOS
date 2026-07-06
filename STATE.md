# NordicOS — Estado del Proyecto

**Última actualización:** 2026-07-06
**Versión:** v0.1.0 (tag en git)
**Repo:** https://github.com/Lmz-23/NordicOS

## Descripción

Sistema de paleta centralizada para entorno de escritorio Hyprland con estética vikinga (oscuro, hierro, hielo, sin tema Nord genérico). Una sola fuente de verdad (`palette/master.css`) genera los configs de color de 4 componentes.

## Componentes sincronizados

| Componente | Archivo generado | Notas |
|---|---|---|
| Waybar | `~/.config/waybar/themes/nordic.css` | @define-color, regenerado completo |
| Kitty | `~/.config/kitty/theme.conf` | Incluido via `include theme.conf` en kitty.conf |
| Wofi | `~/.config/wofi/style.css` | Regenerado completo (config manual en `~/.config/wofi/config`) |
| Hyprland | Bloque en `~/.config/hypr/hyprland.lua` | Reemplazo entre markers `-- >>> NORDICOS PALETTE START >>>` / `-- <<< NORDICOS PALETTE END <<<` |

## Sistema de paleta

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

### Extras hardcoded (solo en kitty ANSI)
- `magenta: #8b7aa0` (color5)
- `magenta-bright: #a898c8` (color13)
- `bright-white: #ffffff` (color15)

## Estructura del proyecto

```
/home/lmz/nordicos/
├── palette/
│   ├── master.css       ← fuente única (editar para cambiar colores)
│   ├── build.js         ← generador (lee master.css, escribe 4 destinos)
│   ├── watch.js         ← watcher automático (chokidar + debounce 200ms)
│   ├── README.md        ← documentación completa
│   └── preview.html     ← (ignorado en git) preview visual generado
├── STATE.md             ← este archivo
├── package.json         ← scripts: build, watch
├── package-lock.json
├── .gitignore
├── backups/             ← (ignorado en git) backups automáticos de cada cambio
└── node_modules/        ← (ignorado en git) dependencias npm (chokidar)
```

## Workflow diario

```bash
# 1. Arrancar watcher (una terminal aparte)
cd /home/lmz/nordicos && npm run watch

# 2. Editar master.css en tu editor favorito
nano /home/lmz/nordicos/palette/master.css
# O usar `npm run preview` para ver el HTML preview

# 3. El watcher detecta el cambio → ejecuta build automáticamente
# Output en consola: "Cambio detectado → Build OK"

# 4. Recargar componentes manualmente para ver cambios:
pkill waybar && waybar &    # waybar
hyprctl reload              # bordes/sombras
killall kitty && kitty      # nueva terminal con colores nuevos
wofi --show drun            # wofi se ve al invocarlo
```

## Git workflow

- Rama `master` = producción/estable
- Rama `develop` = trabajo activo
- Tag actual: `v0.1.0`
- Remote: `https://github.com/Lmz-23/NordicOS.git`
- Commits en español, estilo Conventional Commits

```bash
# Trabajo en develop
git checkout develop
# ... editar, build, verificar ...
git add palette/master.css
git commit -m "feat: nuevo color accent-soft"

# Merge a master cuando esté estable
git checkout master
git merge develop
```

## Issues resueltos en este sistema

1. **colors.css huérfano** (eliminado en Fase 6b) — nadie lo importaba
2. **Colores Hyprland fuera de paleta** — reemplazados por bloque generado
3. **swww-daemon muerto en autostart.sh** — eliminado en Fase 6b
4. **style-legacy.css 329 líneas** — eliminado en Fase 6b
5. **config.jsonc.bak** — eliminado en Fase 6b
6. **JSON malformado en config.jsonc** — corregido
7. **Bug buildHyprlandColors (newline extra)** — corregido en Fase 6a

## Componentes pendientes (futuro)

- Hyprlock (lock screen) — bloqueado por binario no instalado
- Conky (paneles laterales con docker/git status) — no iniciado
- Tema GTK global — no iniciado
- Tema de iconos vikingo — no iniciado