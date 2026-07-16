#!/usr/bin/env -S ags run
import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import type Gdk from "gi://Gdk?version=4.0"
import { createBinding, For, This, onCleanup } from "ags"
import { BatteryWidget } from "./widgets/battery/BatteryWidget"
import { SystemWidget } from "./widgets/system/SystemWidget"
import { NetworkWidget } from "./widgets/network/NetworkWidget"
import { CalendarWidget } from "./widgets/calendar/CalendarWidget"

// NordicOS — shell entry point (Bloque B + Fase 5 + Ronda 10 + autopos + multimonitor + Ronda 12 separación).
//
// Cuatro widgets flotan en CADA monitor conectado, debajo de waybar, con
// márgenes RELATIVOS al monitor donde se renderizan. Las proporciones se
// mantienen idénticas entre eDP-1 (1366×768) y HDMI-A-1 (1920×1080) → el
// layout no se rompe al cambiar de pantalla.
//
// MULTI-MONITOR (Ronda 11):
//   `<For each={monitors}>` (createBinding reactivo) itera `app.monitors` y
//   crea 1 ventana por widget por monitor. `gdkmonitor={monitor}` pinea la
//   ventana a ese monitor en el layer-shell. Nombre único por instancia:
//     - nordicos-system-eDP-1      en laptop
//     - nordicos-system-HDMI-A-1   en TV
//   Namespace compartido (`nordicos-system`) para CSS / identificación
//   lógica. Hot-plug: cuando se conecta/desconecta un monitor, el binding
//   `monitors` emite y el For añade/elimina ventanas automáticamente; el
//   `onCleanup` destruye las ventanas del monitor removido.
//
// TOGGLE GLOBAL DESDE WAYBAR (Ronda 11):
//   Tras el refactor multimonitor las ventanas tienen nombre
//   `nordicos-X-${connector}` (no `nordicos-X` exacto). Como
//   `App.toggle_window(name)` solo busca por nombre EXACTO, `ags toggle
//   nordicos-X` (que waybar ejecuta por click) NO encontraría ninguna
//   ventana → error.
//
//   Solución: shell expone un comando custom `toggle-all <prefix>` vía
//   `requestHandler` (ver `app.start({ requestHandler })` más abajo).
//   waybar debe llamar `ags request toggle-all nordicos-X` en lugar de
//   `ags toggle nordicos-X`. Esto togglea TODAS las ventanas con
//   `name === prefix` o `name.startsWith(prefix + "-")` en una sola
//   pulsación, sincronizando ambos monitores.
//
// Ratios (basados en posiciones del eDP-1, mantenidos en HDMI-A-1):
//   - margin-top    system    = 10/768   = 0.01302 → 14  px en 1080p
//   - margin-top    network   = 238/768  = 0.30990 → 335 px en 1080p
//   - margin-right  (todos)   = 12/1366  = 0.00878 → 17  px en 1080p
//   - margin-bottom battery   = 216/768  = 0.28125 → 304 px en 1080p
//   - margin-bottom calendar  = 11/768   = 0.01432 → 15  px en 1080p
//
// AGS 3.1.0 API: Astal.Window acepta atributos kebab-case individuales
// (`margin-top`, `margin-right`, etc.) que se traducen a llamadas
// `set_margin_top(gint)` etc. NO soporta ratios/porcentajes nativos —
// los píxeles se calculan en base al `Gdk.Monitor` de la ventana.
//
// Implementación: cada window monta un `setup` callback que:
//   1. Aplica los márgenes inmediatamente con la geometría del `monitor`
//      pasado (Ronda 11 — antes usaba `self.get_current_monitor()` pero
//      layer-shell GTK4 retornaba siempre el monitor primario, ignorando
//      el `gdkmonitor` pineado).
//   2. Se conecta a "realize", "map" y "notify::gdkmonitor" para re-aplicar
//      cuando la ventana se realiza, mapea o cambia de monitor.
//   3. Fallback con GLib.idle_add por si realize/map ya ocurrieron antes
//      de que conectáramos (race condition en el mount).
//
// IMPORTANTE GTK4: GdkMonitor4 requiere `get_geometry()` para obtener
// `{x, y, width, height}` (GdkRectangle). Los wrappers GdkWaylandMonitor
// y GdkX11Monitor NO exponen width/height como properties en GJS.
//
// WORKAROUND ags 3.1.2: el `createRoot((dispose) => { this.#main?.() })`
// en /usr/share/ags/js/lib/gtk4/app.ts:290 descarta el return value de
// main(). Usamos `<This this={app}>` que invoca `appendChild` → el
// jsx-runtime (jsx-runtime.ts:132) detecta Gtk.Window + Gtk.Application
// y llama `app.add_window(window)` automáticamente.

// Ronda 12 — separación visible entre widgets (Battery y Calendar se solapaban).
//
// ALTURAS REALES por widget (verificadas vía hyprctl en eDP-1):
//   - system   h=213   (3 sparklines + padding/spacing)
//   - network  h=189   (2 sparklines + padding)
//   - battery  h= 63   (1 barra + label)
//   - calendar h=190   (calendario mensual + tiempo)
//   - Total contenido = 655 px
//
// PANTALLA eDP-1 (768p):
//   - Waybar ocupa 0..37 (TOP layer reservado).
//   - AGS OVERLAY tiene OFFSET +37 para TOP-anchored: la y real = margin_top + 37
//     (descubierto en Ronda 12 — waybar reserva el área TOP en layer-shell).
//   - Para BOTTOM-anchored (battery, calendar) NO hay offset: y_top = h - margin_bottom - h_widget.
//   - Espacio útil para contenido + gaps: 768 - 37 (waybar) = 731 px.
//   - Gap budget: 731 - 655 = 76 px → ~19 px promedio por cada uno de los 4 gaps.
//
// LAYOUT OBJETIVO eDP-1 (gaps visibles, sin overlap):
//   - waybar (TOP layer):       0..37
//   - system  (TOP anchor, +37):    y= 47..260 → gap waybar 10,   gap→network 15
//   - network (TOP anchor, +37):    y=275..464 → gap→battery 25
//   - battery (BOTTOM anchor):      y=489..552 → gap→calendar 15
//   - calendar (BOTTOM anchor):     y=567..757 → gap→bottom 11
//
// RATIOS (calculadas para que `set_margin_X(round(h * ratio))` produzca el y deseado):
//   - RATIO_TOP_SYSTEM     = ( 47-37)/768 = 10/768 = 0.01302
//   - RATIO_TOP_NETWORK    = (275-37)/768 = 238/768 = 0.30990
//   - RATIO_BOTTOM_BATTERY = (768-552)/768 = 216/768 = 0.28125
//   - RATIO_BOTTOM_CALENDAR= (768-757)/768 = 11/768 = 0.01432
const RATIO_TOP_SYSTEM = 10 / 768 // 0.01302 → 10px margin (efectivo y=47), 14px en 1080p
const RATIO_TOP_NETWORK = 238 / 768 // 0.30990 → 238px margin (efectivo y=275), 335px en 1080p
const RATIO_RIGHT = 12 / 1366 // 0.00878 → 12px en 768p, 17px en 1080p
const RATIO_BOTTOM_BATTERY = 216 / 768 // 0.28125 → 216px margin (battery termina y=552), 304px en 1080p
const RATIO_BOTTOM_CALENDAR = 11 / 768 // 0.01432 → 11px margin (calendar termina y=757), 15px en 1080p

// Ronda 11 multimonitor: pasamos el `monitor` Gdk explícitamente en lugar
// de `self.get_current_monitor()`. En layer-shell GTK4 a menudo retorna
// el monitor primario del display (no el pineado por `gdkmonitor={...}`),
// así que las ratios se calculaban siempre con h=768. Usando el monitor
// real (que pasamos en JSX) garantizamos ratios correctos por output.
function applyAutoMargins(
  self: Astal.Window,
  monitor: Gdk.Monitor,
  ratio: { top?: number; bottom?: number; right?: number },
): void {
  let applied = false
  const apply = () => {
    try {
      if (!monitor) return
      // GdkMonitor4 (GTK4) → dimensiones vía get_geometry() (GdkRectangle).
      const geom = monitor.get_geometry()
      if (!geom || geom.width <= 0 || geom.height <= 0) return
      const w = geom.width
      const h = geom.height
      if (ratio.top !== undefined) {
        self.set_margin_top(Math.round(h * ratio.top))
      }
      if (ratio.bottom !== undefined) {
        self.set_margin_bottom(Math.round(h * ratio.bottom))
      }
      if (ratio.right !== undefined) {
        self.set_margin_right(Math.round(w * ratio.right))
      }
      applied = true
    } catch (_e) {
      // Silencioso: si GTK todavía no inicializó el surface, reintentamos
      // en realize/map/notify::gdkmonitor o en el idle fallback.
    }
  }
  apply()
  self.connect("realize", apply)
  self.connect("map", apply)
  self.connect("notify::gdkmonitor", apply)
  // Fallback para realize/map ya ocurridos (race condition en mount).
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    if (!applied) apply()
    return GLib.SOURCE_REMOVE
  })
}

// TOGGLE GLOBAL DESDE WAYBAR (Ronda 11 multimonitor):
// `app.toggle_window(name)` solo busca por nombre EXACTO (no por prefijo).
// Como ahora cada ventana tiene nombre `nordicos-X-${connector}`, el
// comando `ags toggle nordicos-X` que waybar ejecuta no encuentra
// ninguna ventana exacta → lanzaría error.
//
// Solución: shell expone un comando custom `toggle-all <prefix>` vía
// `requestHandler` (ver `app.start({ requestHandler })` más abajo).
// waybar llama `ags request toggle-all nordicos-X` en lugar de
// `ags toggle nordicos-X`. Esto togglea TODAS las ventanas con
// `name === prefix` o `name.startsWith(prefix + "-")` en una sola
// pulsación, sincronizando ambos monitores.
//
// Nota técnica: NO se pudo monkey-patchear `App.prototype.toggle_window`
// porque el DBus service (app.ts:232) captura la referencia original
// en el constructor vía `bind(this)`, antes de cualquier parcheo del
// prototipo. La función bound invoca siempre la referencia capturada,
// no la versión parchada del prototype. Por eso se usa el canal
// `request` (DBus) vía `requestHandler`.

// --- Componentes de ventana por widget ---
// Cada componente crea UNA ventana pineada al monitor recibido.
// `onCleanup` (registrado en el scope del callback del For) destruye la
// ventana cuando el monitor se elimina del binding (hot-unplug).

function SystemWindow({ monitor }: { monitor: Gdk.Monitor }) {
  const connector = monitor.get_connector()
  let win: Astal.Window | undefined
  onCleanup(() => win?.destroy())
  return (
    <window
      $={(self) => {
        win = self
        applyAutoMargins(self, monitor, {
          top: RATIO_TOP_SYSTEM,
          right: RATIO_RIGHT,
        })
      }}
      visible={false}
      name={`nordicos-system-${connector}`}
      namespace="nordicos-system"
      gdkmonitor={monitor}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
    >
      <SystemWidget />
    </window>
  )
}

function NetworkWindow({ monitor }: { monitor: Gdk.Monitor }) {
  const connector = monitor.get_connector()
  let win: Astal.Window | undefined
  onCleanup(() => win?.destroy())
  return (
    <window
      $={(self) => {
        win = self
        applyAutoMargins(self, monitor, {
          top: RATIO_TOP_NETWORK,
          right: RATIO_RIGHT,
        })
      }}
      visible={false}
      name={`nordicos-network-${connector}`}
      namespace="nordicos-network"
      gdkmonitor={monitor}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
    >
      <NetworkWidget />
    </window>
  )
}

function BatteryWindow({ monitor }: { monitor: Gdk.Monitor }) {
  const connector = monitor.get_connector()
  let win: Astal.Window | undefined
  onCleanup(() => win?.destroy())
  return (
    <window
      $={(self) => {
        win = self
        applyAutoMargins(self, monitor, {
          bottom: RATIO_BOTTOM_BATTERY,
          right: RATIO_RIGHT,
        })
      }}
      visible={false}
      name={`nordicos-battery-${connector}`}
      namespace="nordicos-battery"
      gdkmonitor={monitor}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
    >
      <BatteryWidget />
    </window>
  )
}

function CalendarWindow({ monitor }: { monitor: Gdk.Monitor }) {
  const connector = monitor.get_connector()
  let win: Astal.Window | undefined
  onCleanup(() => win?.destroy())
  return (
    <window
      $={(self) => {
        win = self
        applyAutoMargins(self, monitor, {
          bottom: RATIO_BOTTOM_CALENDAR,
          right: RATIO_RIGHT,
        })
      }}
      visible={false}
      name={`nordicos-calendar-${connector}`}
      namespace="nordicos-calendar"
      gdkmonitor={monitor}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
    >
      <CalendarWidget />
    </window>
  )
}

app.start({
  main() {
    // Binding reactivo: cuando se conecta/desconecta un monitor, el For
    // re-evalúa y crea/destruye las ventanas correspondientes.
    const monitors = createBinding(app, "monitors")

    return (
      <For each={monitors}>
        {(monitor) => (
          <This this={app}>
            <SystemWindow monitor={monitor} />
            <NetworkWindow monitor={monitor} />
            <BatteryWindow monitor={monitor} />
            <CalendarWindow monitor={monitor} />
          </This>
        )}
      </For>
    )
  },
  // Ronda 11: handler para `ags request toggle-all <prefix>`. Togglea
  // sincronizadamente TODAS las ventanas que coincidan con el prefijo
  // (ej: `nordicos-system` togglea `nordicos-system-eDP-1` y
  // `nordicos-system-HDMI-A-1` a la vez).
  //
  // Ronda 14 (2026-07-12): blacklist de prefijos que el usuario quiere
  // permanentemente ocultos. `toggle-all` sobre estos prefijos es no-op
  // (devuelve mensaje en vez de mutar `visible`). Mantiene las ventanas
  // creadas pero invisibles aunque waybar u otro caller intente togglear.
  requestHandler(args, response) {
    const [cmd, ...rest] = args
    if (cmd === "toggle-all") {
      const prefix = rest[0]
      if (!prefix) {
        response("toggle-all requires a prefix")
        return
      }
      // Ronda 14: calendar y battery están desactivados permanentemente.
      if (prefix === "nordicos-calendar" || prefix === "nordicos-battery") {
        response(`toggle-all "${prefix}" disabled (widget always hidden)`)
        return
      }
      type WinLike = { name?: string | null; visible: boolean }
      const matches = app.windows.filter((w) => {
        const n = (w as unknown as WinLike).name
        return n === prefix || (n != null && n.startsWith(prefix + "-"))
      })
      if (matches.length === 0) {
        response(`no windows with prefix "${prefix}"`)
        return
      }
      const anyHidden = matches.some((w) => !w.visible)
      matches.forEach((w) => (w.visible = anyHidden))
      response(
        `toggled ${matches.length} windows of "${prefix}" → visible=${anyHidden}`,
      )
      return
    }
    response(`unknown command: ${cmd ?? "<none>"}`)
  },
})