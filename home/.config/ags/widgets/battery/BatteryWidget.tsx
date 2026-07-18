// NordicOS — Battery widget (Bloque B Fase 1 + ronda 8 + ronda 10 + ronda 11
// + ronda final con barra horizontal).
// Display: glyph + porcentaje grande + tiempo restante (info condensada)
// + barra horizontal de carga en la parte inferior.
// Click: la widget es read-only — el toggle de visibilidad se hace desde
// waybar (`on-click: ags toggle nordicos-battery`). El detalle completo
// vía D-Bus se ofrece SOLO en middle-click del módulo waybar battery.
//
// Decisiones técnicas:
// - Estilos inline en css={...} (más simple, sin imports CSS externos).
//   battery.css se mantiene como documentación canónica (no se importa).
// - createPoll usa el 3er overload: (init, interval, fn). fn = readBattery
//   async → devuelve Promise<BatteryStatus> (Ronda 11: upower fallback).
// - Sin botón interno: la widget es informativa. El toggle ocurre en waybar.
// - Glyphs Unicode BMP estables (no PUA Nerd Font).
// - Barra horizontal custom (Opción B): dos boxes anidadas (track + fill).
//   Track: surface elevado, fill: accent blue proporcional a capacity.
//   hexpand=true → la barra se estira a todo el ancho del widget.
//   min-height=4px (literal, sin sp()) para garantizar visibilidad en
//   cualquier monitor. Con scale factor, sp(4) podría dar 3px o menos.
// - Tiempo formateado según estado (Ronda final Bloque B):
//   - Full                              → "Cargado"
//   - Charging + tiempo válido (>0)     → "Xh Ym → llena"
//   - Discharging + tiempo válido (>0)  → "Xh Ym restantes"
//   - Charging sin tiempo               → "Cargando" (sin "…")
//   - Discharging sin tiempo            → "Calculando" (sin "…")
//   - Unknown o sin datos               → "—"
// - Porcentaje font-size 1.3em (era default) para hacerlo más prominente
//   en la barra de estado, ya que es el dato más visible (Ronda final).

import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import { createPoll } from "ags/time"
import { readBattery, BatteryStatus } from "../../lib/battery-source"
import { theme } from "../../lib/theme-tokens-auto"
import { getMonitorScale, sp, se } from "../../lib/scale"

const REFRESH_MS = 30_000 // 30s es suficiente para battery
const TRACK_HEIGHT = 4     // px literal (Ronda final Bloque B)

function getGlyph(status: BatteryStatus["status"], capacity: number): string {
  // Glifos Unicode BMP estables (no PUA Nerd Font, que no renderiza
  // en este widget por config Pango de ags). Visualmente representan
  // el nivel de carga de la batería de forma ASCII-compatible.
  if (!status || status === "Unknown") return "\u2022"  // bullet
  if (status === "Charging") return "\u26A1"             // ⚡ lightning
  if (status === "Full") return "\u2588"                 // █ full block
  // Discharging (o cualquier otro) → nivel por capacity (block elements).
  if (capacity >= 80) return "\u2588"  // █ full
  if (capacity >= 60) return "\u2589"  // ▉ 7/8 block
  if (capacity >= 40) return "\u258A"  // ▊ 6/8 block
  if (capacity >= 20) return "\u258B"  // ▋ 5/8 block
  return "\u258C"                      // ▌ 4/8 block
}

/**
 * Formatea minutos a texto SIEMPRE útil, según el estado de la batería.
 * Nunca retorna string vacío — el label del widget siempre muestra contexto.
 *
 * Cambios Ronda final Bloque B:
 * - "Calculando…" → "Calculando" (sin "…" para coincidir con "Cargando")
 * - "Cargando…" → "Cargando" (idem)
 *
 * - Full                              → "Cargado"
 * - Charging + tiempo válido (>0)     → "Xh Ym → llena"
 * - Discharging + tiempo válido (>0)  → "Xh Ym restantes"
 * - Charging sin tiempo               → "Cargando"
 * - Discharging sin tiempo            → "Calculando"
 * - Unknown o sin datos               → "—"
 */
function formatTime(minutes: number, status: BatteryStatus["status"]): string {
  if (status === "Full") return "Cargado"
  if (status === "Unknown") return "—"
  const hasTime = Number.isFinite(minutes) && minutes > 0
  if (status === "Charging") {
    if (!hasTime) return "Cargando"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m → llena` : `${m}m → llena`
  }
  if (status === "Discharging") {
    if (!hasTime) return "Calculando"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`
  }
  return "—"
}

export function BatteryWidget() {
  // createPoll<T>(init, interval, fn) — overload 3 de time.ts.
  // fn async → soporta Promise<T> en createPoll (time.ts:90).
  // init es tipo T (no Promise<T>). Usamos SYNC readBattery (que aún
  // exportamos vía busy-poll para init only) → BatteryStatus directo
  // con present=true si BAT0 existe. Si BAT0 no existe, initial=empty.
  // El primer tick async reemplazará el valor con datos frescos (~30ms).
  //
  // NOTA: usamos `visible={battery.as((b) => b.present)}` en lugar de
  // `visible={battery().present}` porque gnim NO auto-trackea llamadas
  // a Accessor<T>() en props directos (solo en .as()). Sin .as(), el
  // binding es one-shot — el widget quedaría invisible para siempre
  // tras el primer render con present=false.
  const present = GLib.file_test("/sys/class/power_supply/BAT0", GLib.FileTest.EXISTS)
  const initial: BatteryStatus = present
    ? {
        present: true,
        capacity: 0,
        status: "Unknown",
        energyNow: 0,
        energyFull: 0,
        energyFullDesign: 0,
        powerNow: 0,
        voltageNow: 0,
        cycleCount: 0,
        timeToEmpty: -1,
        timeToFull: -1,
      }
    : {
        present: false,
        capacity: 0,
        status: "Unknown",
        energyNow: 0,
        energyFull: 0,
        energyFullDesign: 0,
        powerNow: 0,
        voltageNow: 0,
        cycleCount: 0,
        timeToEmpty: -1,
        timeToFull: -1,
      }
  const battery = createPoll<BatteryStatus>(initial, REFRESH_MS, () => readBattery())

  // Auto-escalado por monitor (Ronda 11).
  const scale = getMonitorScale()

  return (
    <box
      visible={battery.as((b) => b.present)}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={sp(6)}
      css={`
        background: ${theme.surface};
        border: 1px solid ${theme.border};
        border-radius: 12px;
        padding: ${sp(24)}px ${sp(24)}px;
        min-width: ${sp(280)}px;
      `}
    >
      {/* Línea 1: glyph + porcentaje grande + tiempo restante */}
      <box orientation={Gtk.Orientation.HORIZONTAL} spacing={sp(8)} halign={Gtk.Align.FILL}>
        <label
          label={battery.as((b) => getGlyph(b.status, b.capacity) || "\u26A1")}
          css={`
            color: ${theme.accent};
            font-size: ${se(1.1)}em;
            font-family: "JetBrainsMono Nerd Font", monospace;
          `}
        />
        {/* Porcentaje más prominente (Ronda final Bloque B):
           font-size 1.3em y font-weight 600 para destacar sobre
           glyph y tiempo. El usuario comenta que "claramente solo
           muestra el porcentaje" — lo hacemos el dato dominante. */}
        <label
          label={battery.as((b) => `${Math.round(b.capacity)}%`)}
          css={`
            color: ${theme.text};
            font-size: ${se(1.3)}em;
            font-weight: 600;
            font-family: monospace;
          `}
        />
        {/* Tiempo restante: charging→timeToFull, resto→timeToEmpty.
           formatTime SIEMPRE devuelve string no vacío. */}
        <label
          label={battery.as((b) =>
            formatTime(
              b.status === "Charging" ? b.timeToFull : b.timeToEmpty,
              b.status,
            )
          )}
          hexpand
          halign={Gtk.Align.END}
          css={`color: ${theme['text-muted']}; font-size: ${se(0.85)}em;`}
        />
      </box>

      {/* Línea 2: barra horizontal de carga (Ronda final Bloque B).
         Track surface-alt (más claro que surface) + fill accent blue
         proporcional a capacity. width-request del fill es relativo
         al ancho interno del widget (≈232px) → Cálculo: (capacity/100)*232. */}
      <box
        orientation={Gtk.Orientation.HORIZONTAL}
        hexpand
        valign={Gtk.Align.END}
        css={`
          background: ${theme['surface-alt']};
          border-radius: 2px;
          min-height: ${TRACK_HEIGHT}px;
        `}
      >
        <box
          width-request={battery.as((b) =>
            Math.max(0, Math.round((b.capacity / 100) * 232))
          )}
          css={`
            background: ${theme.accent};
            min-height: ${TRACK_HEIGHT}px;
            border-radius: 2px;
          `}
        />
      </box>
    </box>
  )
}