// NordicOS — System widget (CPU/RAM/TEMP).
// Display: 3 filas (CPU/RAM/TEMP) con label a la izquierda y valor
// numérico a la derecha; cada fila lleva su sparkline histórica DEBAJO,
// ocupando todo el ancho interno del widget.
// La información se muestra in-place; no hay click handlers que abran
// terminales externas (la widget es read-only).
//
// Decisiones técnicas:
// - Estilos inline `css={...}` (mismo patrón que BatteryWidget).
// - createPoll<T>(init, interval, fn) — overload 3 de time.ts.
//   Primer valor se obtiene llamando readCpu() directamente para evitar
//   mostrar 0% al inicio durante el primer tick.
// - History reactivo: createState<number[]> + createEffect que escucha
//   el polling. La sparkline se suscribe al state y hace queue_draw.
// - createState funcional: setHistory(prev => [...prev, v].slice(-N))
//   garantiza inmutabilidad y respeta el límite de muestras.
// - Subscriptions se desuscriben automáticamente al destruir el widget
//   gracias a onCleanup (gnim scope-aware).
// - Layout: cada fila = <box halign=FILL> con label (hexpand+START) +
//   valor (halign=END). El hexpand=true en el label izquierdo lo
//   expande para absorber todo el espacio sobrante, empujando el valor
//   contra el borde derecho. Sin hexpand ambos labels aparecían pegados
//   ("CPU18%") porque GtkBox los empaqueta secuencialmente sin gaps.
// - La sparkline va FUERA del box, en línea nueva, ocupando todo el
//   ancho interno del widget (sp(232)).
//
// Auto-escalado por monitor (Ronda 11):
// - getMonitorScale() calcula factor basado en monitor más pequeño.
// - eDP-1 (1366px) → 1.0, HDMI-A-1 (1920px) → 0.71.
// - Padding, font-size y min-width escalados proporcionalmente.
// - Sparkline width/height escalados vía prop multiplication.

import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { createEffect, createState } from "ags"
import {
  readCpu,
  readMemory,
  readTemp,
  resetCpuBaseline,
  type CpuSnapshot,
  type MemorySnapshot,
  type TempSnapshot,
} from "../../lib/system-source"
import { theme } from "../../lib/theme-tokens-auto"
import { Sparkline } from "./Sparkline"
import { getMonitorScale, sp, se } from "../../lib/scale"

const CPU_REFRESH_MS = 2_000       // 2s para CPU (suficiente granularidad)
const MEM_REFRESH_MS = 5_000       // 5s para RAM (cambia más lento)
const TEMP_REFRESH_MS = 10_000     // 10s para TEMP (cambia muy lento)
const HISTORY_LEN = 30             // ~60s CPU, ~150s RAM, ~300s TEMP

export function SystemWidget() {
  // ─── Polling reactivo ──────────────────────────────────────────────
  // createPoll retorna Accessor<T> con .subscribe(). La primera
  // subscripción (dentro de createEffect o JSX) inicia el timer.
  const cpu = createPoll<CpuSnapshot>(readCpu(), CPU_REFRESH_MS, readCpu)
  const mem = createPoll<MemorySnapshot>(readMemory(), MEM_REFRESH_MS, readMemory)
  const temp = createPoll<TempSnapshot>(readTemp(), TEMP_REFRESH_MS, readTemp)

  // ─── Historial reactivo (para sparklines) ──────────────────────────
  const [cpuHistory, setCpuHistory] = createState<number[]>([])
  const [memHistory, setMemHistory] = createState<number[]>([])
  const [tempHistory, setTempHistory] = createState<number[]>([])

  // createEffect: cuando cpu() cambia, actualiza cpuHistory. La sparkline
  // escucha cpuHistory vía .subscribe y llama queue_draw automáticamente.
  createEffect(() => {
    const snap = cpu()
    setCpuHistory((prev) => {
      const next = [...prev, snap.percent]
      if (next.length > HISTORY_LEN) next.shift()
      return next
    })
  })

  createEffect(() => {
    const snap = mem()
    setMemHistory((prev) => {
      const next = [...prev, snap.percent]
      if (next.length > HISTORY_LEN) next.shift()
      return next
    })
  })

  createEffect(() => {
    const snap = temp()
    setTempHistory((prev) => {
      const next = [...prev, snap.celsius]
      if (next.length > HISTORY_LEN) next.shift()
      return next
    })
  })

  // CPU baseline reset al destruir el widget — evita delta erróneo
  // si el widget se vuelve a montar en el futuro.
  createEffect(() => {
    return () => resetCpuBaseline()
  })

  // ─── Auto-escalado por monitor (Ronda 11) ──────────────────────────
  const scale = getMonitorScale()
  // Sparkline ocupa todo el ancho interno del widget (min-width 280 -
  // padding horizontal 24*2 = 232). sp() aplica el factor de escala por
  // monitor. Antes era 120px porque compartía fila con label+valor.
  const sparkW = sp(232)
  const sparkH = sp(28)

  // ─── UI ────────────────────────────────────────────────────────────
  return (
    <box
      css={`
        background: ${theme.surface};
        border: 1px solid ${theme.border};
        border-radius: 12px;
        padding: ${sp(24)}px ${sp(24)}px;
        min-width: ${sp(280)}px;
      `}
      spacing={sp(6)}
      orientation={Gtk.Orientation.VERTICAL}
    >
      {/* Título ceremonial — SISTEMA */}
      <label
        label="SISTEMA"
        css={`
          color: ${theme.accent};
          font-size: ${se(1.5)}em;
          letter-spacing: 3px;
          font-weight: 500;
          text-transform: uppercase;
          padding-bottom: ${sp(4)}px;
        `}
        halign={Gtk.Align.CENTER}
      />
      {/* Separador bajo el título — accent para destacar */}
      <box
        css={`
          min-height: 1px;
          background: ${theme.accent};
          margin: 0 ${sp(16)}px ${sp(8)}px ${sp(16)}px;
          opacity: 0.6;
        `}
      />

      {/* CPU row — label izq + valor der; sparkline en línea nueva */}
      <box halign={Gtk.Align.FILL}>
        <label
          label="CPU"
          halign={Gtk.Align.START}
          hexpand={true}
          css={`color: ${theme['text-muted']}; min-width: ${sp(40)}px;`}
        />
        <label
          label={cpu.as((s) => `${s.percent}%`)}
          halign={Gtk.Align.END}
          css={`color: ${theme.text}; min-width: ${sp(42)}px; font-family: monospace;`}
        />
      </box>
      <Sparkline values={cpuHistory} width={sparkW} height={sparkH} color={theme.accent} />

      {/* RAM row — label izq + valor der; sparkline en línea nueva */}
      <box halign={Gtk.Align.FILL}>
        <label
          label="RAM"
          halign={Gtk.Align.START}
          hexpand={true}
          css={`color: ${theme['text-muted']}; min-width: ${sp(40)}px;`}
        />
        <label
          label={mem.as((s) => `${s.percent}%`)}
          halign={Gtk.Align.END}
          css={`color: ${theme.text}; min-width: ${sp(42)}px; font-family: monospace;`}
        />
      </box>
      <Sparkline values={memHistory} width={sparkW} height={sparkH} color={theme.accent} />

      {/* TEMP row — label izq + valor der; sparkline en línea nueva */}
      <box halign={Gtk.Align.FILL}>
        <label
          label="TEMP"
          halign={Gtk.Align.START}
          hexpand={true}
          css={`color: ${theme['text-muted']}; min-width: ${sp(40)}px;`}
        />
        <label
          label={temp.as((t) => `${t.celsius}°C`)}
          halign={Gtk.Align.END}
          css={`color: ${theme.text}; min-width: ${sp(42)}px; font-family: monospace;`}
        />
      </box>
      <Sparkline values={tempHistory} width={sparkW} height={sparkH} color={theme.accent} />
    </box>
  )
}