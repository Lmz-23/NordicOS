# NordicOS — Sistema de Paleta

## ¿Cómo cambiar un color?

1. Edita `master.css` (solo este archivo)
2. Guarda. El watcher regenera todo automáticamente.
3. Abre `preview.html` en tu navegador para ver cómo queda.

## ¿Cómo funcionan los nombres?

Los nombres son **semánticos** (qué rol juega el color), no descriptivos:
- `accent` = color de acento (no "azul" ni "ice")
- `bg` = fondo principal
- `border` = bordes

Si quieres cambiar el azul por rojo, cambias el VALOR hex de `accent`. El nombre sigue siendo `accent`.

## ¿Qué hace cada archivo?

- `master.css` → único archivo que tocas a mano
- `build.js` → lee master.css, escribe a Waybar/Kitty/Wofi/etc.
- `watch.js` → vigila master.css, ejecuta build al cambiar
- `preview.html` → vista previa visual (se regenera en cada build)

## Comandos

```bash
npm run build   # regenerar una vez
npm run watch   # modo vigilante (Ctrl+C para parar)
npm run preview # abrir preview en navegador
```

## Watcher automático

Para que el sistema se regenere automáticamente al editar `master.css`:

```bash
cd /home/lmz/nordicos && npm run watch
```

El watcher:

- Vigila `palette/master.css` (solo cambios de contenido, no creación ni borrado)
- Espera 200ms (debounce) para evitar múltiples builds en guardados rápidos — 5 saves en rápida sucesión → 1 build
- Ejecuta `node palette/build.js` automáticamente
- Muestra el output del build inline en la consola (incluye diffs de cada destino)
- Sigue vigilando aunque el build falle (no se cae, espera al próximo cambio)
- Para parar: Ctrl+C — shutdown limpio, sin procesos huérfanos

**Workflow recomendado:**

1. Abrí `palette/master.css` en tu editor
2. En otra terminal: `npm run watch`
3. Editá colores, guardá → todo se regenera automáticamente
4. Si querés ver los cambios en vivo: `pkill waybar && waybar &` (recargar waybar manualmente)

**Detalles de implementación** (por si te interesa):

- Usa [chokidar](https://github.com/paulmillr/chokidar) 3.6+ (única dependencia npm del proyecto)
- `awaitWriteFinish` espera 100ms a que el archivo termine de escribirse antes de disparar el evento `change` (evita leer archivos a medio escribir en discos lentos)
- Si llega otro cambio mientras un build está corriendo, el nuevo se omite (el próximo cambio reactivará el watcher automáticamente)
- Doble Ctrl+C fuerza salida inmediata (exit 130) — útil si un build queda colgado

## Mappings por componente

Los nombres semánticos del master (`accent`, `error`, etc.) se traducen a nombres que cada componente espera. Esto pasa porque cada programa tiene su propia convención de nombres.

### Waybar (`~/.config/waybar/themes/nordic.css`)

| Master | Waybar | Razón |
|--------|--------|-------|
| `bg` | `bg` | igual |
| `surface` | `surface` | igual |
| `surface-alt` | `surface-alt` | igual |
| `border` | `border` | igual |
| `accent` | `ice` | waybar usa nombre "ice" para el acento principal |
| `accent-soft` | `ice-soft` | nombre espejo del acento principal |
| `text` | `text` | igual |
| `text-muted` | `text-muted` | igual |
| `success` | `success` | igual |
| `warning` | `warning` | igual |
| `error` | `danger` | waybar usa "danger" en vez de "error" |

Los valores hex son siempre idénticos — solo cambia el nombre.

### Kitty (`~/.config/kitty/theme.conf` + `~/.config/kitty/kitty.conf`)

Estrategia: **archivo separado** — Kitty soporta `include theme.conf`. La migración es **one-shot** y automática: la primera vez que se ejecuta `build.js`, las líneas de color de `kitty.conf` se extraen y se mueven a `theme.conf`; `kitty.conf` recibe una línea `include theme.conf`. Builds subsiguientes solo regeneran `theme.conf`.

| Master | Kitty | Notas |
|--------|-------|-------|
| `bg` | `background` | igual |
| `surface` | (no se usa directo) | Kitty solo usa un bg principal |
| `surface-alt` | (no se usa directo) | — |
| `border` | `selection_background` + `color4` + `color8` | bordes ANSI y selección |
| `accent` | `cursor` + `color6` + `color12` | cursor + cyan ANSI |
| `accent-soft` | `url_color` + `color14` | URL highlight + cyan bright |
| `text` | `foreground` + `selection_foreground` + `color7` | foreground + selección invertida |
| `text-muted` | (no se usa directo) | — |
| `success` | `color2` + `color10` | verde ANSI |
| `warning` | `color3` + `color11` | amarillo ANSI |
| `error` | `color1` + `color9` | rojo ANSI |

#### Extras hardcoded (no vienen del master)

Tres colores del palette ANSI extendido **no tienen contraparte semántica** en `master.css` y están **hardcoded** dentro de `buildKittyTheme()`:

| Color | Hex | ANSI slot | Razón |
|-------|-----|-----------|-------|
| `magenta` | `#8b7aa0` | color5 | Tono lila frío para ANSI magenta |
| `magenta-bright` | `#a898c8` | color13 | Versión bright del magenta |
| `bright-white` | `#ffffff` | color15 | Blanco puro para brightest |

Estos valores están definidos en la constante `KITTY_EXTRAS` al inicio de `palette/build.js`. Si quieres cambiarlos, edita esa constante.

### Wofi (`~/.config/wofi/style.css`)

Estrategia: **full file replacement** — Wofi usa CSS plano (sin `@define-color`), así que el archivo generado contiene los valores hex directamente.

Estilo: **ornamentado nórdico** — bordes prominentes (2px), distinción clara entre hover y selected, focus indicator con línea vertical de hielo, spacing generoso, y un `box-shadow` inset sutil en la ventana para profundidad.

| Master | Wofi CSS property | Notas |
|--------|-------------------|-------|
| `surface` | `window { background-color }` | fondo del launcher |
| `accent` | `window border (2px)` + `window box-shadow inset` + `#input:focus border-color` + `#input:focus box-shadow (línea vertical)` + `#entry:selected color/border-left` + `#entry:hover border-left` | borde + focus indicator + highlight |
| `bg` | `#input background-color` | fondo del campo de búsqueda |
| `text` | `color` (varios) | texto principal |
| `border` | `#input border` | borde del input |
| `text-muted` | `#prompt color` | etiqueta del prompt (sobre el input) |

**Variantes alpha** se generan dinámicamente con `hexToRgba()`:
- `rgba(120, 199, 255, 0.15)` — selection highlight (accent @15%)
- `rgba(120, 199, 255, 0.10)` — window inner-shadow depth tint (accent @10%)
- `rgba(120, 199, 255, 0.06)` — hover background (accent @6%, muy sutil)
- `rgba(120, 199, 255, 0.30)` — hover border-left indicator (accent @30%)

Si cambias `accent` en master, las cuatro variantes se actualizan en lock-step. Las tres últimas (10%, 6%, 30%) son intensidades decorativas nuevas del estilo ornamentado; la primera (15%) viene de la versión anterior.

#### Configuración manual recomendada

El archivo `~/.config/wofi/config` **NO** es generado por el build (solo `style.css` lo es). Para aprovechar el estilo ornamentado con orientación vertical:

```ini
width=500
height=600
location=center
show=drun
prompt=Buscar...
filter_rate=100
allow_markup=true
no_actions=true
halign=fill
orientation=vertical        # ← más cómodo que horizontal para launchers
content_halign=fill
insensitive=true
allow_images=true
image_size=28               # ← más grande que el default de 24
```

Después de cambiar el config, corre `npm run build` para regenerar el style y verás el resultado con `wofi --show drun`.

> ⚠ Estos ajustes son **manuales** — el build no los puede tocar. Son decisiones de UX/diseño, no de paleta.

### Hyprland (`~/.config/hypr/hyprland.lua`)

Estrategia: **marker block replacement** — `hyprland.lua` tiene 368+ líneas (keybinds, monitors, animations). NO sobrescribimos. En su lugar, delimita el bloque `col { ... }` con markers y `build.js` reemplaza solo esa sección.

**Mapping**:

| Hyprland field | Master token | Formato generado |
|----------------|--------------|------------------|
| `active_border` (gradient, tabla) | `accent` + `accent-soft` | `{ colors = {"rgba(78c7ffee)", "rgba(a0d4ffee)"}, angle = 45 }` |
| `inactive_border` | `border` | `"rgba(3b556daa)"` (string simple, alpha 67%) |

> ⚠ **Formato ESTRICTAMENTE requerido por Hyprland Lua**: `active_border` DEBE ser una **tabla** con las claves `colors` (lista de strings rgba) y `angle` (número de grados). El formato string con múltiples valores separados por espacio (`"rgba(...) rgba(...) 45deg"`) **NO funciona** en Hyprland Lua y hace que `hyprctl reload` aborte con `invalid color "..."`. Hyprland solo acepta ese shorthand en archivos de config no-Lua.

#### Setup manual de markers (requerido una vez)

`build.js` **NO auto-inyecta** los markers — es decisión tuya dónde colocarlos. Para configurar:

1. Abre `~/.config/hypr/hyprland.lua`
2. Localiza el bloque `col { ... }` existente (líneas ~101-104 en el config autogenerado). Luce así:

   ```lua
   col = {
       active_border   = { colors = {"rgba(33ccffee)", "rgba(00ff99ee)"}, angle = 45 },
       inactive_border = "rgba(595959aa)",
   },
   ```

3. Envuélvelo con markers:

   ```lua
   -- >>> NORDICOS PALETTE START >>>
   col = {
       active_border   = { colors = {"rgba(33ccffee)", "rgba(00ff99ee)"}, angle = 45 },
       inactive_border = "rgba(595959aa)",
   },
   -- <<< NORDICOS PALETTE END <<<
   ```

4. Guarda. La próxima vez que corras `npm run build`, el bloque entero (las 9 líneas entre markers, incluyéndolos) será reemplazado por el nuevo bloque generado.

**Scope intencionalmente estrecho**: este generador SOLO emite `col = { active_border, inactive_border }`. NO toca `decoration.shadow` ni `decoration.shadow_offset`. Esos viven en secciones separadas de `hyprland.lua` que el usuario mantiene a mano — mezclarlos aquí fue exactamente el bug de la iteración anterior.

#### Diagnóstico: ¿qué pasa si no pongo los markers?

`build.js` mostrará un warning y seguirá adelante con los demás componentes:

```
⚠ Hyprland: markers no encontrados. Añádelos manualmente:
  1. Abre ~/.config/hypr/hyprland.lua
  2. Localiza el bloque `col = { ... }` (líneas ~101-104)
  3. Envuélvelo con markers:
       -- >>> NORDICOS PALETTE START >>>
       col = { ... }
       -- <<< NORDICOS PALETTE END <<<
  Ver palette/README.md para más detalles.
```

Es un proceso manual, intencionalmente. Las decisiones de scope (qué entra/sale del bloque generado) son tuyas.
