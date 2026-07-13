# NordicOS

> Sistema de escritorio Hyprland con identidad visual vikinga coherente, construido alrededor de un único generador de paleta que sincroniza todos los componentes del sistema desde una sola fuente de verdad.

![Kitty + fastfetch demo](kitty_fastfetch_demo.png)

---

## Tabla de contenidos

1. [Visión general](#visión-general)
2. [Filosofía de diseño](#filosofía-de-diseño)
3. [Arquitectura](#arquitectura)
4. [Inicio rápido](#inicio-rápido)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Stack tecnológico](#stack-tecnológico)
7. [Sistema de paleta](#sistema-de-paleta)
8. [Comandos disponibles](#comandos-disponibles)
9. [Flujo de trabajo diario](#flujo-de-trabajo-diario)
10. [Testing](#testing)
11. [Documentación](#documentación)
12. [Versionado y releases](#versionado-y-releases)
13. [Roadmap](#roadmap)
14. [Contribución](#contribución)
15. [Licencia y autoría](#licencia-y-autoría)

---

## Visión general

**NordicOS** es un *rice* (configuración estética completa) para Hyprland que lleva la metáfora del drakkar vikingo al escritorio: hierro sobre escarcha, madera sellada sobre cubierta, una paleta única y doce roles semánticos que cualquier componente del sistema puede heredar.

El núcleo del proyecto no es un *theme* en sentido tradicional — es un **sistema de tokens** con un único archivo editable (`palette/master.css`) desde el que se regeneran automáticamente todos los archivos de configuración de color de los componentes del sistema.

```
                    palette/master.css
                            |
                            v
                    palette/build.js
                            |
            +-------+-------+-------+-------+
            v               v               v
         Waybar          Kitty           Wofi
     (nordic.css)    (theme.conf)     (style.css)
            |               |               |
            v               v               v
       Hyprland         Dunst           AGS
     (marker block)   (dunstrc)    (theme-tokens-auto.ts)
```

**Siete destinos**, una sola fuente, cero valores duplicados.

---

## Filosofía de diseño

NordicOS parte de tres principios que están documentados en profundidad en [`docs/design-language.md`](docs/design-language.md):

- **Hierro sobre escarcha.** Materiales fríos, densos, con peso. Nada brilla por accidente.
- **El mar manda.** El wallpaper es paisaje, no decoración. La UI flota sobre él, no lo tapa.
- **Cada módulo merece su solemnidad.** No todo es ceremonial, pero nada es trivial.

La paleta canónica tiene solo **doce colores** (más tres extras en kitty para ANSI extendido) y cada uno evoca un material: hierro fundido, roble sellado, acero frío, hielo glaciar, hueso tallado, musgo sobre roca, sangre seca. Los nombres son **semánticos** (`accent`, `error`, `text`), nunca descriptivos — cambiar el azul por rojo es un solo hex, no un rename en cascada.

La documentación del lenguaje visual cubre jerarquía tipográfica, sistema de marcos, escala de solemnidad, motivos ceremoniales (Valknut, runas Elder Futhark), voz del sistema y patrones prohibidos. Está escrita como un contrato: cualquier pieza nueva que no respete el contrato debe poder justificarlo narrativamente.

---

## Arquitectura

### Single source of truth

Un único archivo (`palette/master.css`) declara doce `@define-color` con nombres semánticos. El resto del sistema se deriva de él:

| Token | Hex | Material evocado |
|---|---|---|
| `bg` | `#0b0f14` | Hierro fundido en frío |
| `surface` | `#151c24` | Roble sellado al aceite |
| `surface-alt` | `#1a2332` | Cuero curtido y bruñido |
| `border` | `#3b556d` | Acero forjado en frío |
| `accent` | `#78c7ff` | Hielo glaciar bajo luz oblicua |
| `accent-soft` | `#a0d4ff` | Nieve iluminada por amanecer |
| `text` | `#d4dde3` | Hueso blanco tallado |
| `text-muted` | `#8a9bab` | Tinta diluida en agua |
| `success` | `#6fbf73` | Musgo sobre roca |
| `warning` | `#d89b3c` | Latón viejo / oro deslucido |
| `error` | `#b84c4c` | Sangre seca sobre acero |
| `shadow` | `#1a1a1a` | Carbón profundo (Hyprland shadow, alpha `ee`) |

### Tres estrategias de generación

El build aplica tres estrategias distintas según la naturaleza del destino:

1. **Full replacement** — el archivo destino se regenera por completo. Usado para `waybar`, `wofi`, `dunst` y `ags`.
2. **Included via `include`** — `kitty` separa la paleta en un `theme.conf` que `kitty.conf` incluye. La primera ejecución migra el config automáticamente (*one-shot*).
3. **Marker-block splice** — `hyprland.lua` tiene cientos de líneas (keybinds, monitors, animations). El build delimita dos bloques con markers (`NORDICOS PALETTE START/END` y `NORDICOS SHADOW START/END`) y reemplaza solo el contenido entre ellos. Idempotente y *byte-stable*.

### Renames explícitos

Cada componente tiene su propio vocabulario. El build traduce los nombres semánticos del master al dialecto de cada app:

| Master token | Waybar | Kitty | Wofi | Hyprland |
|---|---|---|---|---|
| `accent` | `ice` | `cursor` + `color6/12` | `accent` | `active_border[0]` |
| `accent-soft` | `ice-soft` | `url_color` + `color14` | `accent-soft` | `active_border[1]` |
| `error` | `danger` | `color1/9` | `error` | — |
| `text` | `text` | `foreground` + `color7` | `text` | — |
| `border` | `border` | `selection_background` + `color4/8` | `border` | `inactive_border` |

Los renames se declaran una sola vez por componente (objetos `*_MAPPING` al inicio de `palette/build.js`). El orden es estable: los diffs entre builds son predecibles.

### Validaciones

Cada `npm run build` ejecuta:

- Validación de hex estricto (`/^#[0-9a-fA-F]{6}$/`)
- Warnings estructurados por línea malformada en `master.css`
- **Validación de sintaxis Lua** del bloque Hyprland con `luac -p -` antes de escribir
- Tres substrings requeridos en el bloque Lua (forma estructural)
- **Idempotencia** por *byte-equality* — si el contenido destino no cambia, no se bumpea mtime y no se genera backup
- Escritura atómica (`writeFile` a `.tmp` + `rename`) — nunca queda un archivo corrupto a mitad de escritura

---

## Inicio rápido

### Requisitos

- **Sistema operativo:** Linux (probado en Arch, CachyOS, Nobara)
- **Compositor:** Hyprland
- **Runtime:** Node.js 18+ (testado en 20 LTS y 22)
- **Opcional:** `luac` (lua compiler) para validación sintáctica del bloque Hyprland durante el build

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Lmz-23/NordicOS.git ~/nordicos
cd ~/nordicos

# 2. Instalar dependencias (única: chokidar para el watcher)
npm install

# 3. Vincular los archivos de configuración a sus destinos en ~/.config/
#    (ver tabla "Destinos generados" abajo para paths exactos)

# 4. Construir la paleta una vez
npm run build
```

### Destinos generados

| Componente | Path destino | Estrategia |
|---|---|---|
| Waybar | `~/.config/waybar/themes/nordic.css` | Full replacement |
| Kitty | `~/.config/kitty/theme.conf` | Included via `kitty.conf` |
| Wofi | `~/.config/wofi/style.css` | Full replacement |
| Hyprland (palette) | `~/.config/hypr/hyprland.lua` (entre markers PALETTE) | Marker-block splice |
| Hyprland (shadow) | `~/.config/hypr/hyprland.lua` (entre markers SHADOW) | Marker-block splice |
| Dunst | `~/.config/dunst/dunstrc` | Full replacement |
| AGS widgets | `~/.config/ags/lib/theme-tokens-auto.ts` | Full replacement (TypeScript module) |

*Además se genera `palette/preview.html` como artefacto local (ignorado en git).*

### Activar el modo de regeneración automática

```bash
npm run watch
```

Edita `palette/master.css` en cualquier editor y los siete destinos se regeneran automáticamente al guardar. Debounce de 200 ms; cierre limpio con `Ctrl+C`.

---

## Estructura del proyecto

```
nordicos/
├── palette/
│   ├── master.css              ← ÚNICO archivo a editar para cambiar colores
│   ├── build.js                ← Generador: lee master.css, escribe 7 destinos
│   ├── watch.js                ← Watcher con debounce 200ms (chokidar)
│   ├── preview.html            ← Preview visual autogenerado (ignorado en git)
│   ├── README.md               ← Documentación del subsistema de paleta
│   └── test/
│       └── build.test.js       ← Suite de tests (node:test)
├── docs/
│   ├── design-language.md      ← ADN visual: manifiesto, principios, patrones
│   ├── design-system.md        ← Especificación técnica: tokens, contratos, validaciones
│   └── references/             ← Capturas canónicas y material de referencia
├── assets/
│   ├── wallpapers/             ← 10 fondos (drakkar, fiordos, runas, etc.)
│   └── ornaments/              ← Valknut y marcos ornamentales
├── backups/                    ← Snapshots automáticos por cambio (versionados)
├── STATE.md                    ← Estado del proyecto, issues resueltos, pendientes
├── package.json
├── package-lock.json
└── README.md                   ← Este archivo
```

---

## Stack tecnológico

**Runtime del sistema:**

| Componente | Tecnología | Rol |
|---|---|---|
| Compositor | [Hyprland](https://hyprland.org/) | Window manager dinámico |
| Barra | [Waybar](https://github.com/Alexays/Waybar) | Barra superior con módulos |
| Terminal | [Kitty](https://sw.kovidgoyal.net/kitty/) | Emulador de terminal GPU |
| Launcher | [Wofi](https://hg.sr.ht/~scoopta/wofi) | Lanzador de aplicaciones |
| Notificaciones | [Dunst](https://dunst-project.org/) | Demonio de notificaciones |
| Widgets | [AGS](https://github.com/Aylur/ags) (Astal/GJS) | Widgets GTK custom (calendar, battery) |

**Tooling del proyecto:**

| Pieza | Tecnología | Uso |
|---|---|---|
| Generador | Node.js (>=18) | Sin dependencias externas excepto `chokidar` |
| Watcher | [chokidar](https://github.com/paulmillr/chokidar) 3.6 | Detección de cambios en `master.css` |
| Tests | `node:test` (built-in) | Suite sin dependencias |
| Validación Lua | `luac -p -` | Verifica sintaxis del bloque Hyprland antes de escribir |

**Tipografía:** JetBrainsMono Nerd Font (primaria), Symbols Nerd Font, FontAwesome, Roboto, Helvetica, Arial, sans-serif. Stack consolidado en la constante `FONT_STACK` dentro de `palette/build.js`.

---

## Sistema de paleta

### Cómo cambiar un color

1. Editar `palette/master.css` (único archivo que el usuario toca).
2. Guardar.
3. Si el watcher está corriendo (`npm run watch`), los siete destinos se regeneran automáticamente. Si no, ejecutar `npm run build`.
4. Recargar componentes manualmente para ver los cambios en vivo:

```bash
pkill waybar && waybar &          # Waybar
hyprctl reload                    # Hyprland (bordes y sombras)
killall kitty && kitty            # Kitty
wofi --show drun                  # Wofi (efímero, se ve al invocarlo)
pkill dunst && dunst &            # Dunst
```

### Nombres semánticos, no descriptivos

Los tokens son **roles**, no colores. Cambiar `accent` de azul a rojo es un solo hex; el nombre sigue siendo `accent`. Los renames por componente (`accent → ice` en Waybar, `error → danger` en Waybar) están declarados una sola vez en los objetos `*_MAPPING` de `palette/build.js`.

Para detalles exhaustivos sobre mappings por componente, variantes alpha de `accent` en Wofi, hardcoded extras de Kitty y restricciones de formato del bloque Hyprland Lua, ver [`palette/README.md`](palette/README.md).

---

## Comandos disponibles

Definidos en [`package.json`](package.json):

```bash
npm run build      # Genera la paleta una vez (lee master.css, escribe 7 destinos)
npm run watch      # Modo vigilante: rebuild automático al guardar master.css
npm run preview    # Abre palette/preview.html en el navegador (xdg-open)
npm test           # Ejecuta la suite de tests (palette/test/build.test.js)
```

---

## Flujo de trabajo diario

### Cambiar un color

```bash
# Terminal 1 — watcher activo
cd ~/nordicos && npm run watch

# Terminal 2 (o tu editor) — editar master.css
nano palette/master.css
# guardar → el watcher detecta cambio → build automático → output inline

# Recargar componentes manualmente
pkill waybar && waybar &
hyprctl reload
killall kitty && kitty
```

### Añadir un token nuevo

1. Añadir línea `@define-color mi-token #abcdef;` en `palette/master.css` (respetar la sección narrativa correspondiente).
2. Si el token debe llegar a algún componente, declarar el mapping en su objeto `*_MAPPING` correspondiente dentro de `palette/build.js`.
3. Si el token tiene un destino completamente nuevo (Hyprlock, GTK, Conky), redactar el contrato siguiendo el formato de `docs/design-system.md` §4.
4. Añadir tests para el nuevo mapping/función en `palette/test/build.test.js`.

---

## Testing

```bash
npm test
```

Suite implementada con `node:test` (built-in, sin dependencias). Cubre:

- **`HEX_REGEX`** — validación estricta de hex de 6 dígitos con `#`
- **`parseMaster`** — parser de `@define-color` con warnings estructurados por línea
- **`hexToRgba` / `hexToRgbaString` / `hexToHyprlandNumber`** — helpers de conversión
- **`escapeHtml`** — escape de 5 entidades para el preview HTML
- **`buildWaybarTheme`** — GTK CSS con renames `accent → ice`, `error → danger`
- **`buildKittyTheme`** — directivas kitty + 16 ANSI + 3 extras hardcoded
- **`buildWofiStyle`** — CSS plano + 4 variantes alpha de `accent` (0.06, 0.10, 0.15, 0.30)
- **`buildHyprlandColors`** — bloque Lua con gradient *table form*, 3 substrings requeridos, no trailing newline, idempotencia byte-a-byte
- **`buildHyprlandShadow`** — bloque Lua con `0xAARRGGBB` numérico, markers SHADOW independientes de los PALETTE
- **`buildDunstConfig`** — `[global]` + 3 secciones `[urgency_*]` con 3 directivas cada una
- **`buildPreviewHtml`** — documento HTML self-contained con todas las cards
- **`replaceMarkerBlock`** — splice puro (no toca disco), retorna null si faltan markers
- **`atomicWrite`** — POSIX-atomic via `.tmp` + `rename`, mkdir -p recursivo, sin residuos
- **`generateDiff`** — diff LCS unificado, retorna null si contenido idéntico
- **`WAYBAR_MAPPING` / `KITTY_MAPPING` / `WOFI_MAPPING` / `KITTY_EXTRAS`** — integridad estructural

Las pruebas de luac se saltan automáticamente si el binario no está instalado (`{ skip: !commandExists('luac') }`).

---

## Documentación

El proyecto tiene tres documentos que se complementan sin duplicarse:

| Documento | Qué contiene | Cuándo leerlo |
|---|---|---|
| [`docs/design-language.md`](docs/design-language.md) | Manifiesto, principios, metáfora fundacional, jerarquía tipográfica, motivos ceremoniales, anti-patrones | Antes de añadir cualquier componente nuevo al sistema |
| [`docs/design-system.md`](docs/design-system.md) | Especificación técnica: capas de tokens, contratos por app, validaciones del build | Al implementar o extender el build.js |
| [`palette/README.md`](palette/README.md) | Detalles operativos del subsistema de paleta: mappings por componente, alpha variants, marker setup manual, troubleshooting | Al usar o extender el build |

**Regla de prioridad:** si estos documentos entran en conflicto, `design-language.md` gana sobre `design-system.md`, que gana sobre `palette/README.md`. Actualizar primero la fuente, sincronizar después.

**Regla del spec:** el spec manda sobre la implementación. Si una app diverge del contrato, la app está mal. Si el contrato es incorrecto, se actualiza el contrato, después el ADN, después la paleta, después el build, después las apps. **Nunca** se ajusta el contrato para coincidir con una implementación divergente.

---

## Versionado y releases

- **Semver ligero:** el proyecto usa [Semantic Versioning](https://semver.org/) en formato `MAJOR.MINOR.PATCH`.
- **Tag actual:** `v0.1.0` — primera iteración estable del sistema de paleta centralizada.
- **Conventional Commits:** los mensajes siguen el formato `tipo(scope): descripción` en español. Tipos usados: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- **Branches:**
  - `master` — producción/estable
  - `develop` — trabajo activo
- **Remote:** `https://github.com/Lmz-23/NordicOS.git`

### Historial reciente

```
278876a feat: Bloque B Fase 6 - integración final, single source of truth completo (master.css -> 7 destinos)
b4c2afe feat: Bloque B Fase 1 - widget Batería flotante con ags
036e053 Refactor code structure for improved readability and maintainability
488c7fd Implement code changes to enhance functionality and improve performance
5f78081 fix(build): remover newline extra en buildHyprlandColors
6414b21 feat: NordicOS palette centralizada inicial
```

---

## Roadmap

Componentes contemplados pero no integrados todavía:

| Componente | Estado | Bloqueo |
|---|---|---|
| Hyprlock (lock screen ceremonial) | Pendiente | Binario no instalado |
| Conky (paneles laterales con docker/git status) | No iniciado | — |
| Tema GTK global | No iniciado | — |
| Tema de iconos vikingo | No iniciado | — |
| SDDM (login manager) | Pendiente | Theme por defecto de la distro |
| Notificaciones críticas (Valknut animado) | Diseño | — |

Issues resueltos en el sistema de paleta actual (ver [`STATE.md`](STATE.md) para detalle):

1. `colors.css` huérfano — eliminado
2. Colores Hyprland fuera de paleta — bloque generado
3. `swww-daemon` muerto en autostart — eliminado
4. `style-legacy.css` (329 líneas) — eliminado
5. `config.jsonc.bak` — eliminado
6. JSON malformado en `config.jsonc` — corregido
7. Bug `buildHyprlandColors` (newline extra) — corregido
8. Block Hyprland shadow con sintaxis string-form — migrado a numeric form
9. Marker cross-contamination (PALETTE vs SHADOW) — pinneado con tests

---

## Contribución

NordicOS es un proyecto personal documentado como si fuera profesional. Las contribuciones externas son bienvenidas si respetan el lenguaje visual y los contratos técnicos.

**Antes de proponer un cambio:**

1. Lee [`docs/design-language.md`](docs/design-language.md) completo. Si tu propuesta introduce un gradiente chillón, glassmorphism genérico, neón saturado o emoji decorativo, no encaja.
2. Lee [`docs/design-system.md`](docs/design-system.md) §4 (contratos por app) si vas a tocar el build o añadir un destino nuevo.
3. Lee [`palette/README.md`](palette/README.md) si vas a modificar mappings existentes.

**Estilo de código:**

- Sin dependencias innecesarias. El build usa solo built-ins de Node.js (`fs`, `path`, `child_process`, `os`, `crypto`).
- Funciones puras siempre que sea posible. I/O aislado en `main()` y `writeComponentWithBackup()`.
- Comentarios en español, formato de cabecera con `===` separators.
- Tests con `node:test` + `node:assert/strict`. Sin frameworks externos.
- Mensajes de commit en español, Conventional Commits.

**Verificación previa a un PR:**

```bash
npm run build    # debe terminar sin errores
npm test         # todos los tests deben pasar
```

---

## Licencia y autoría

**Autor:** Lmz-23 ([@Lmz-23](https://github.com/Lmz-23))

NordicOS es un proyecto personal de configuración estética. El código del build (`palette/build.js`, `palette/watch.js`, tests) se distribuye tal cual; el contenido visual (wallpapers, marcos ornamentales, runas) es obra original del autor.

El Valknut, las runas Elder Futhark y los motivos nórdicos son símbolos culturales de uso libre; su inclusión en este proyecto es decorativa y referencial, sin afiliación a tradición religiosa o política alguna.

---

> *"La cubierta no compite con el mar. Lo usa."*
> — Manifiesto de NordicOS