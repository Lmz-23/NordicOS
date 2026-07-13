# NordicOS — Especificación técnica del sistema de diseño

> **Fuente única de verdad visual:** `docs/design-language.md` (ADN).
> **Fuente única de verdad de valores:** `palette/master.css` (12 colores canónicos + 3 extras kitty).
> **Si este documento entra en conflicto con cualquiera de los anteriores, los anteriores ganan.** Actualizar primero la fuente, sincronizar después.

---

## 0. Propósito

Esta especificación traduce el ADN visual a **contratos que las apps pueden heredar hoy**: los tokens que existen, los renames activos, y las validaciones que el build aplica. No es un manual de cómo extender el sistema — eso se redacta cuando haga falta extender.

**Qué NO es:**
- Una guía de cómo escribir CSS, INI, QML o Lua.
- Una duplicación de la paleta canónica (vive en master.css).
- Una proyección del sistema al futuro.

---

## 1. Principios

1. **Una sola fuente por tipo de valor.** La paleta hex vive en master.css. El lenguaje vive en el ADN. Esta especificación solo documenta la **proyección** entre ambos.
2. **Sin tokens sin consumer.** Si un token se declara, al menos una app debe leerlo. Tokens muertos son deuda.
3. **Sin magic numbers en apps.** Cada valor que se repita entre dos o más archivos va aquí.
4. **Renames explícitos.** El único rename activo hoy es waybar (`accent → ice`, `error → danger`). Si una app futura requiere rename, se declara una vez en su contrato.

---

## 2. Sistema de tokens

### 2.1 Capa 1: Primitives

Valores crudos que las apps consumen directa o indirectamente. Hoy son tres grupos:

**Colores canónicos** — declarados en `palette/master.css`. Lista completa con comentario narrativo por línea en ese archivo. Resumen:

```
bg           surface      surface-alt
border       accent       accent-soft
text         text-muted
success      warning      error
shadow
```

Extras kitty (no aparecen en master.css, viven en `KITTY_EXTRAS` dentro de `palette/build.js`):
```
magenta       magentaBright     brightWhite
```

**Stack de fuentes** — un solo valor compartido, derivado en `palette/build.js` y referenciado por las apps que lo consumen. Hoy declarado como constante `FONT_STACK` cuando se implemente la fase B.1:

```
"JetBrainsMono Nerd Font", "Symbols Nerd Font", FontAwesome,
Roboto, Helvetica, Arial, sans-serif
```

> **Por qué existe:** el reviewer detectó 4 archivos con stacks divergentes (waybar/wofi/kitty). Consolidar elimina una inconsistencia real.

### 2.2 Capa 2: Roles semánticos

Asignan un nombre semántico a un primitive. **Es la única capa que las apps consumen.** Cuando una app necesita un color, lee por su rol semántico (con su rename local si aplica).

| Rol semántico | Primitive | Material evocado (del ADN) |
|---|---|---|
| `bg` | bg | Hierro fundido |
| `surface` | surface | Roble sellado |
| `surface-alt` | surface-alt | Cuero bruñido |
| `border` | border | Acero frío |
| `accent` | accent | Hielo glaciar |
| `accent-soft` | accent-soft | Nieve iluminada |
| `text` | text | Hueso tallado |
| `text-muted` | text-muted | Tinta diluida |
| `success` | success | Musgo sobre roca |
| `warning` | warning | Latón viejo |
| `error` | error | Sangre seca |

Tres colores kitty (`magenta`, `magentaBright`, `brightWhite`) **no tienen rol semántico** — son slots ANSI sin uso abstracto. Documentados como primitivos, sin proyección semántica.

### 2.3 Capa 3 (no existe)

No hay tercera capa. La Capa 2 (roles semánticos) es suficiente para que las apps existentes hereden.

> **Si en el futuro hace falta una capa de "tokens de componente"** (espacios de nombres como `panel.*`, `state.*`, `data.*`), se crea cuando una segunda app necesite el mismo concepto. Una capa creada "por si acaso" se convierte en tokens muertos.

---

## 3. Variantes alpha de accent (un solo caso)

Wofi es la única app hoy que usa variantes alpha del accent. Cuatro variantes, calculadas en runtime por `hexToRgba()`:

| Alpha | Hex equivalente | Uso |
|---|---|---|
| 0.06 | `rgba(accent, 0.06)` | Hover background |
| 0.10 | `rgba(accent, 0.10)` | Inner shadow decorativo |
| 0.15 | `rgba(accent, 0.15)` | Selection background |
| 0.30 | `rgba(accent, 0.30)` | Hover border-left indicator |

**Regla:** las cuatro se derivan del mismo primitive `accent`. Cambiar `accent` en master.css actualiza las cuatro en lock-step. No se documentan variantes adicionales hasta que una app las necesite.

---

## 4. Contratos por aplicación

Cada contrato declara: archivo destino, formato, naming, renames. Si una app no aparece, no tiene contrato.

### 4.1 Waybar

| Aspecto | Valor |
|---|---|
| **Archivo generado** | `~/.config/waybar/themes/nordic.css` |
| **Formato** | CSS GTK con `@define-color` |
| **Naming** | kebab-case |
| **Renames activos** | `accent → ice`, `accent-soft → ice-soft`, `error → danger` |
| **Implementación** | `WAYBAR_MAPPING` en `palette/build.js` |

Los 12 roles semánticos se traducen a nombres waybar vía `WAYBAR_MAPPING`. Orden estable: difs predecibles entre builds.

### 4.2 Wofi

| Aspecto | Valor |
|---|---|
| **Archivo generado** | `~/.config/wofi/style.css` |
| **Formato** | CSS plano con hex inline (no soporta `@define-color`) |
| **Naming** | kebab-case en selectores; hex literal en valores |
| **Renames activos** | Ninguno |
| **Implementación** | `buildWofiStyle()` + `hexToRgba()` para variantes alpha |

Tokens consumidos: `surface` (fondo), `accent` (border + variantes alpha), `bg` (input bg), `text` (texto), `border` (input border), `text-muted` (prompt). Cuatro alphas de accent definidos en §3.

### 4.3 Kitty

| Aspecto | Valor |
|---|---|
| **Archivo generado** | `~/.config/kitty/theme.conf` |
| **Incluido vía** | `include theme.conf` en `kitty.conf` (migración one-shot, `migrateKittyConfig()`) |
| **Formato** | Directivas kitty con `background`, `foreground`, `cursor`, `selection_*`, `url_color`, `color0..color15` |
| **Naming** | snake_case |
| **Renames activos** | `bg → background`, `text → foreground` + `selection_foreground` + `color7`, `border → selection_background` + `color4` + `color8`, `accent → cursor` + `color6` + `color12`, `accent-soft → url_color` + `color14`, `error → color1` + `color9`, `success → color2` + `color10`, `warning → color3` + `color11` |
| **Extras** | `magenta → color5`, `magentaBright → color13`, `brightWhite → color15` |
| **Implementación** | `KITTY_MAPPING` + `KITTY_EXTRAS` en `palette/build.js` |

### 4.4 Hyprland (marker block)

| Aspecto | Valor |
|---|---|
| **Archivo modificado** | `~/.config/hypr/hyprland.lua` (entre markers `-- >>> NORDICOS PALETTE START >>>` / `-- <<< NORDICOS PALETTE END <<<`) |
| **Formato** | Lua table con claves `colors` y `angle` |
| **Naming** | snake_case |
| **Renames activos** | `accent → active_border[0]`, `accent-soft → active_border[1]`, `border → inactive_border` |
| **Implementación** | `buildHyprlandColors()` + `replaceMarkerBlock()` en `palette/build.js` |

**Restricciones críticas** (lecciones del pasado, no romper):

- `active_border` DEBE ser **tabla** con `colors` (lista de strings `rgba(8hex)`) y `angle` (número). NO string shorthand `"rgba(...) rgba(...) 45deg"` (es sintaxis `.conf`, no `.lua`).
- Trailing comma obligatoria después del cierre `},` (la tabla vive dentro de `general = { ... }`).
- **NO trailing newline** al final del bloque (acumula blank lines por build).
- `luac -p -` debe parsear el bloque antes de escribir.
- Pattern check: 3 substrings requeridos en `buildHyprlandColors`.
- Idempotencia: byte-equality check antes de escribir (no bumpea mtime si no hay cambios).
- Alpha del gradient activo: `'ee'` (~93%). Alpha del inactivo: `'aa'` (~67%). Constantes locales; no parametrizar todavía.

### 4.5 Apps pendientes de contrato

Las siguientes apps existen o pueden existir en el futuro, pero **no tienen contrato todavía** porque no leen del sistema de tokens:

- **Dunst** — usa defaults upstream (`/etc/dunst/dunstrc`). Contrato se redactará cuando se cree `~/.config/dunst/dunstrc`.
- **Hyprlock** — binario no instalado. Pendiente.
- **SDDM** — theme por defecto de la distro. Pendiente.

> **Regla:** no se redacta contrato para una app hasta que exista archivo de configuración que vaya a heredar del sistema. Contratos vacíos son ruido.

---

## 5. Validaciones implementadas en build

Estas validaciones corren en cada `npm run build`. Documentarlas aquí para que cualquier modificación de `palette/build.js` las respete:

| Validación | Mecanismo | Falla reportada |
|---|---|---|
| Hex válido en master.css | `HEX_REGEX` strict (`/^#[0-9a-fA-F]{6}$/`) | Warning estructurado por línea |
| Línea malformada con `@define-color` | `parseMaster()` separa válidos de warnings | Warning con número de línea |
| Token faltante por destino | Loop `WAYBAR_MAPPING`, etc., busca primitive | `/* MISSING in master.css: ... */` inline |
| Lua syntax del bloque Hyprland | `execSync('luac -p -')` con bloque envuelto en mock table | Error con diagnóstico luac + bloque generado |
| Forma estructural del bloque Hyprland | 3 substrings requeridos en el contenido generado | Error con substrings faltantes |
| Idempotencia | `byte-equality` pre-write vs buffer | No-op silencioso si bytes idénticos |
| Escritura atómica | `writeFile` a `.tmp` + `rename` | Sin archivo corrupto a mitad de escritura |

**Tests automatizados** (Z.0 del plan de migración): no existen todavía. Son plan de implementación, no parte del sistema de tokens. Cuando se implementen, este spec se actualiza.

---

## 6. Lo que NO es parte del sistema de tokens

Decisiones que quedan fuera del sistema y son responsabilidad de cada app o del usuario:

- Comportamiento runtime (animaciones, eventos de teclado, timing de focus).
- Keybindings y mouse bindings del WM.
- Wallpapers (decisión de UX/fotografía).
- Iconos de apps externas (branding de cada app; el dock acepta logos oficiales bajo política §10.5 del ADN).
- Theme de iconos del sistema, cursor del sistema.
- Tema GTK de apps externas.
- Tipografía física instalada en el sistema.
- Layouts de Hyprland (dwindle, master, etc.).
- Composición de ventanas.

---

## 7. Cierre

Esta especificación documenta los contratos que las apps existentes ya firmaron. Si una nueva app quiere integrarse al sistema, se agrega un §4.X siguiendo el formato de los existentes — sin reescribir lo que ya está.

Lo que el sistema no tiene todavía (motion centralizado, escalas de spacing/radius/typography, capa de tokens de componente) se agrega **el día que dos apps necesiten lo mismo**. Una abstracción para un solo uso es sobreingeniería.

**Regla fundamental:** el spec manda sobre la implementación. Si una app diverge del contrato, la app está mal. Si el contrato es incorrecto, se actualiza el contrato, después el ADN, después la paleta, después el build, después las apps. **Nunca** se ajusta el contrato para coincidir con una implementación divergente.