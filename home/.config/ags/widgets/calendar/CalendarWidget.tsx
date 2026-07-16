// NordicOS — Calendar widget (Bloque B Fase 4, Ronda 6 + valknut accent).
// Display ceremonial del día actual con ornamento valknut (Norse symbol).
// Read-only display, sin click handlers.
//
// Patrón ceremonial (vertical, 4 líneas):
//   - Línea 1: año + mes      ("2026 JULIO")
//   - Línea 2: día grande     (número destacado)
//   - Línea 3: valknut        (símbolo, centrado solo)
//   - Línea 4: día semana     ("VIERNES")
//
// Aspect ratio vertical: el calendario es estrecho y alto (140×220 px) para
// destacar la pila vertical día → valknut → weekday, en contraste con los
// widgets anchos del Bloque B (SystemWidget/BatteryWidget/NetworkWidget).
//
// Decisiones técnicas:
// - Hora/fecha calculada con `new Date()`.
// - Valknut (símbolo nórdico de Odín, tres triángulos entrelazados + runas)
//   en color `theme.accent` (#78c7ff) — azul ceremonial sobre surface oscuro.
//   PNG fuente: `valknut-accent.png` (360×286 RGBA, regenerado desde
//   `valknut-complete.png` con script Python: triángulos y runas en
//   accent blue con alpha=220, círculo/fondo con alpha=0 para que se
//   vea el surface del widget debajo).
// - createPoll cada 60s (1 min es suficiente granularidad para un
//   calendario; el día solo cambia una vez al día, pero queremos
//   que la medianoche se refresque sola sin esperar a un toggle).
// - Labels con `.as()` para reactividad (Patrón 1: gnim JSX template
//   literals NO son reactivos).
// - Sin click handlers: el calendario es read-only.
// - Sin sparklines (no aplica para calendar).
//
// Spacing vertical (Ronda final Bloque B):
// - spacing=12 entre líneas (antes 8 → 10) para mejor respiración con valknut
//   64px y mes/año + weekday a 1.1em.
// - padding 20 vertical / 16 horizontal.
//
// Valknut pixelSize literal 64 (no sp(64)):
// - sp() aplica monitor scale factor y con 2 monitores activos retorna valores
//   reducidos (38-42px aprox.). Valor literal garantiza 64px reales en
//   cualquier configuración, dando presencia dominante al símbolo ceremonial.
//   Subido 32 → 48 → 64 para que el valknut domine la composición.

import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import { createPoll } from "ags/time"
import { theme } from "../../lib/theme-tokens-auto"
import { getMonitorScale, sp, se } from "../../lib/scale"

interface CalendarSnapshot {
  day: number             // 1-31
  month: number           // 1-12 (no 0-11)
  year: number            // 4 dígitos
  weekday: string         // LUNES, MARTES, ...
}

const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]

const WEEKDAYS_ES = [
  "DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO",
]

// Path absoluto al PNG del valknut (360×286 RGBA, COMPLETO y recoloreado
// a theme.accent con fondo transparente). Resuelto via GLib.getenv("HOME")
// para portabilidad entre users. NOTA: NO usar prefijo `file://` —
// GtkImage.set_from_file() espera un PATH absoluto, no una URI. Con `file://`
// GTK4 falla silenciosamente y muestra el icono "broken image".
const valknutPath = `${GLib.getenv("HOME")}/.config/ags/assets/ornaments/valknut.png`

function readCalendar(): CalendarSnapshot {
  const now = new Date()
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,  // 1-12
    year: now.getFullYear(),
    weekday: WEEKDAYS_ES[now.getDay()],
  }
}

export function CalendarWidget() {
  // Polling cada 60s (1 min es suficiente granularidad para un calendario).
  // Inicializamos con la fecha actual para evitar mostrar un valor stale
  // durante el primer tick.
  const cal = createPoll<CalendarSnapshot>(readCalendar(), 60_000, readCalendar)

  // Auto-escalado por monitor (Ronda 11): aplicado a padding/font-size,
  // pero NO al pixelSize del valknut (que ya es literal para nitidez).
  const scale = getMonitorScale()

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      halign={Gtk.Align.CENTER}
      spacing={sp(12)}
      css={`
        background: ${theme.surface};
        border: 1px solid ${theme.border};
        border-radius: 12px;
        padding: ${sp(20)}px ${sp(16)}px;
        min-width: ${sp(140)}px;
        min-height: ${sp(220)}px;
      `}
    >
      {/* Línea 1: mes/año */}
      <label
        label={cal.as((c) => `${c.year} ${MONTHS_ES[c.month - 1]}`)}
        css={`
          color: ${theme['text-muted']};
          font-size: ${se(1.2)}em;
          letter-spacing: 1px;
        `}
        halign={Gtk.Align.CENTER}
      />

      {/* Línea 2: día destacado */}
      <label
        label={cal.as((c) => c.day.toString())}
        css={`color: ${theme.text}; font-size: ${se(2.6)}em; font-weight: 700; font-family: monospace;`}
        halign={Gtk.Align.CENTER}
      />

      {/* Línea 3: valknut (centrado, solo). pixelSize 64 (era 32 → 48) para
         presencia dominante como símbolo ceremonial. */}
      <image
        file={valknutPath}
        pixelSize={64}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      />

      {/* Línea 4: weekday */}
      <label
        label={cal.as((c) => c.weekday)}
        css={`
          color: ${theme['text-muted']};
          font-size: ${se(1.2)}em;
          letter-spacing: 1px;
        `}
        halign={Gtk.Align.CENTER}
      />
    </box>
  )
}
