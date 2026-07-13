# NordicOS — Estado del Proyecto

**Última actualización:** 2026-07-13
**Versión:** v0.1.0 (tag en git) + Bloque B Fase 6 (single source of truth completo)
**Repo:** https://github.com/Lmz-23/NordicOS

## Descripción

Sistema de paleta centralizada para entorno de escritorio Hyprland con estética vikinga (oscuro, hierro, hielo, sin tema Nord genérico). Una sola fuente de verdad (`palette/master.css`) genera los configs de color de **siete destinos** totalmente sincronizados.

## Componentes sincronizados

| # | Componente | Archivo generado | Estrategia |
|---|---|---|---|
| 1 | Waybar | `~/.config/waybar/themes/nordic.css` | Full replacement (`@define-color`) |
| 2 | Kitty | `~/.config/kitty/theme.conf` | Included via `include theme.conf` en `kitty.conf` (migración one-shot) |
| 3 | Wofi | `~/.config/wofi/style.css` | Full replacement (CSS plano, 4 variantes alpha de `accent`) |
| 4 | Hyprland (palette) | Bloque en `~/.config/hypr/hyprland.lua` | Marker-block splice `NORDICOS PALETTE START/END` (gradient *table form*) |
| 5 | Hyprland (shadow) | Bloque en `~/.config/hypr/hyprland.lua` | Marker-block splice `NORDICOS SHADOW START/END` (`0xAARRGGBB` numérico) |
| 6 | Dunst | `~/.config/dunst/dunstrc` | Full replacement (`[global]` + 3 secciones `[urgency_*]`) |
| 7 | AGS widgets | `~/.config/ags/lib/theme-tokens-auto.ts` | Full replacement (TypeScript module `theme` const) |

Además se genera `palette/preview.html` como artefacto local (ignorado en git).

## Sistema de paleta

### Paleta canónica (12 tokens)

| Token | Hex | Uso |
|---|---|---|
| bg | `#0b0f14` | Fondo principal |
| surface | `#151c24` | Paneles |
| surface-alt | `#1a2332` | Superficie elevada |
| border | `#3b556d` | Bordes |
| accent | `#78c7ff` | Acento principal |
| accent-soft | `#a0d4ff` | Acento secundario |
| text | `#d4dde3` | Texto principal |
| text-muted | `#8a9bab` | Texto secundario |
| success | `#6fbf73` | Éxito |
| warning | `#d89b3c` | Advertencia |
| error | `#b84c4c` | Error |
| shadow | `#1a1a1a` | Hyprland `decoration.shadow.color` (alpha `ee` empaquetado por helper) |

### Extras hardcoded (solo en kitty ANSI)

- `magenta: #8b7aa0` (color5)
- `magenta-bright: #a898c8` (color13)
- `bright-white: #ffffff` (color15)

Definidos en la constante `KITTY_EXTRAS` al inicio de `palette/build.js`. Sin contraparte semántica en `master.css`.

## Estructura del proyecto

```
/home/lmz/nordicos/
├── palette/
│   ├── master.css              ← fuente única (editar para cambiar colores)
│   ├── build.js                ← generador (lee master.css, escribe 7 destinos)
│   ├── watch.js                ← watcher automático (chokidar + debounce 200ms)
│   ├── preview.html            ← (ignorado en git) preview visual generado
│   ├── README.md               ← documentación operativa del subsistema de paleta
│   └── test/
│       └── build.test.js       ← suite de tests (node:test, 1530 líneas)
├── docs/
│   ├── design-language.md      ← ADN visual: manifiesto, principios, anti-patrones
│   ├── design-system.md        ← Especificación técnica: tokens, contratos, validaciones
│   └── references/             ← Capturas canónicas y material de referencia
├── assets/
│   ├── wallpapers/             ← 10 fondos (drakkar, fiordos, runas, monolitos)
│   └── ornaments/              ← Valknut y marcos ornamentales
├── backups/                    ← (ignorado en git) snapshots automáticos por cambio
├── node_modules/               ← (ignorado en git) única dependencia: chokidar 3.6
├── STATE.md                    ← este archivo
├── README.md                   ← documentación general del proyecto
├── package.json                ← scripts: build, watch, preview, test
├── package-lock.json
└── .gitignore
```

## Workflow diario

```bash
# 1. Arrancar watcher (una terminal aparte)
cd /home/lmz/nordicos && npm run watch

# 2. Editar master.css en tu editor favorito
nano /home/lmz/nordicos/palette/master.css

# 3. El watcher detecta el cambio → ejecuta build automáticamente
#    Output en consola: "→ Ejecutando build..." + diffs por destino

# 4. Recargar componentes manualmente para ver cambios:
pkill waybar && waybar &     # waybar
hyprctl reload               # hyprland (bordes y sombras)
killall kitty && kitty       # nueva terminal con colores nuevos
wofi --show drun             # wofi (efímero, se ve al invocarlo)
pkill dunst && dunst &       # dunst
```

## Validaciones implementadas en build

| Validación | Mecanismo |
|---|---|
| Hex válido en master.css | `HEX_REGEX` estricto |
| Línea malformada con `@define-color` | Warnings estructurados por línea |
| Token faltante por destino | `/* MISSING in master.css: ... */` inline |
| Sintaxis Lua del bloque Hyprland | `execSync('luac -p -')` con bloque envuelto en mock table |
| Forma estructural del bloque Hyprland | 3 substrings requeridos en el contenido generado |
| Idempotencia | `byte-equality` pre-write vs buffer (no bumpea mtime) |
| Escritura atómica | `writeFile` a `.tmp` + `rename` |

## Testing

```bash
npm test
```

Suite con `node:test` (built-in, sin dependencias). 1530 líneas cubriendo:

- `HEX_REGEX` — validación estricta de hex de 6 dígitos
- `parseMaster` — parser con warnings estructurados
- `hexToRgba` / `hexToRgbaString` / `hexToHyprlandNumber` — helpers de conversión
- `escapeHtml` — escape de 5 entidades para preview
- `buildWaybarTheme` — GTK CSS con renames
- `buildKittyTheme` — directivas kitty + 16 ANSI + 3 extras
- `buildWofiStyle` — CSS plano + 4 alphas de `accent`
- `buildHyprlandColors` — bloque Lua gradient *table form*, idempotente
- `buildHyprlandShadow` — bloque Lua numérico, markers SHADOW independientes
- `buildDunstConfig` — `[global]` + 3 `[urgency_*]`
- `buildPreviewHtml` — HTML self-contained con todas las cards
- `replaceMarkerBlock` — splice puro (no toca disco)
- `atomicWrite` — POSIX-atomic via `.tmp` + `rename`
- `generateDiff` — diff LCS unificado
- `*_MAPPING` / `KITTY_EXTRAS` — integridad estructural

Las pruebas de luac se saltan automáticamente si el binario no está instalado.

## Git workflow

- Rama `master` = producción/estable
- Rama `develop` = trabajo activo
- Tag actual: `v0.1.0`
- Remote: `https://github.com/Lmz-23/NordicOS.git`
- Commits en español, estilo Conventional Commits

```bash
# Trabajo en develop
git checkout develop
# ... editar, build, verificar, test ...
git add palette/
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
8. **Hyprland shadow block: sintaxis string-form rgba** — migrada a `0xAARRGGBB` numérico (A.1)
9. **Cross-contamination de markers PALETTE/SHADOW** — pinneado con tests de independencia (A.1)

## Componentes pendientes (futuro)

- Hyprlock (lock screen ceremonial) — bloqueado por binario no instalado
- Conky (paneles laterales con docker/git status) — no iniciado
- Tema GTK global — no iniciado
- Tema de iconos vikingo — no iniciado
- SDDM (login manager) — theme por defecto de la distro
- Notificaciones críticas (Valknut animado) — solo diseño