// NordicOS — Network widget (Bloque B Fase 3 + ronda 8 + ronda 11).
// Display: 4 filas (SSID + IP + upload + download) con solo el valor a
// la derecha, y UNA única sparkline de download al final del widget.
// Read-only display, sin click handlers (mismo patrón que SystemWidget).
//
// Decisiones técnicas:
// - createPoll<T>(init, interval, fn) con fn async — soportado por ags
//   time.ts:90 (createPoll acepta Promise<T>).
// - History reactivo: createState<number[]> + createEffect (mismo patrón
//   que SystemWidget). La sparkline se suscribe y redibuja.
// - Sparkline importada de ../system/Sparkline (reutilización, no
//   duplicar el componente Cairo). sp(232)x28px baseline escalada por
//   monitor — ocupa todo el ancho interno del widget.
// - 5s de polling: throughput quiere granularidad, pero 5s evita parpadeo.
// - Labels con `.as()` para reactividad (Patrón 1: gnim JSX template
//   literals NO son reactivos).
// - formatBytes: B/K/M/G con un decimal para legibilidad.
// - Sin click handlers (Patrón 5: read-only display).
// - Layout: 4 filas con solo el valor a la derecha (sin labels de fila
//   para IP/download/upload). La sparkline única de download va al
//   final del widget, fuera de cualquier fila.
//
// Auto-escalado por monitor (Ronda 11):
// - Ver SystemWidget.tsx para detalles completos. Resumen: padding,
//   font-size y sparkline width/height escalados inversamente al width
//   del monitor. En HDMI-A-1 (1920px) la widget se reduce ~29%.

import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { createEffect, createState } from "ags"
import {
  readNetwork,
  resetNetworkBaseline,
  type NetworkSnapshot,
} from "../../lib/network-source"
import { theme } from "../../lib/theme-tokens-auto"
import { Sparkline } from "../system/Sparkline"
import { getMonitorScale, sp, se } from "../../lib/scale"

const REFRESH_MS = 5_000       // 5s — balance entre granularidad y flicker
const HISTORY_LEN = 30         // ~150s de historia (suficiente para sparkline)

/** Formatea bytes/seg en B/K/M/G con un decimal. */
function formatBytesPerSec(bytes: number): string {
  if (bytes <= 0) return "0B"
  if (bytes < 1024) return `${Math.round(bytes)}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}G`
}

export function NetworkWidget() {
  // ─── Polling reactivo ──────────────────────────────────────────────
  // createPoll<T>(init, interval, fn) con fn async. El primer valor se
  // inicializa resolviendo readNetwork() — la versión síncrona inicial
  // muestra ceros hasta el primer tick, lo cual es menos confuso que
  // "disconnected" durante el primer poll.
  const initial: NetworkSnapshot = {
    ssid: "",
    ip: "",
    iface: "",
    rxBytesPerSec: 0,
    txBytesPerSec: 0,
    totalRxBytes: 0,
    totalTxBytes: 0,
    isConnected: false,
  }
  const network = createPoll<NetworkSnapshot>(initial, REFRESH_MS, () => readNetwork())

  // ─── Historial reactivo (para la única sparkline de download) ──────
  const [rxHistory, setRxHistory] = createState<number[]>([])

  createEffect(() => {
    const snap = network()
    setRxHistory((prev) => {
      const next = [...prev, snap.rxBytesPerSec]
      if (next.length > HISTORY_LEN) next.shift()
      return next
    })
  })

  // Reset baseline al destruir el widget — evita delta erróneo
  // si el widget se vuelve a montar en el futuro.
  createEffect(() => {
    return () => resetNetworkBaseline()
  })

  // ─── Auto-escalado por monitor (Ronda 11) ──────────────────────────
  const scale = getMonitorScale()
  // Sparkline ocupa todo el ancho interno del widget (min-width 280 -
  // padding horizontal 24*2 = 232). sp() aplica el factor de escala.
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
      {/* Título ceremonial — RED */}
      <label
        label="RED"
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

      {/* SSID row — label dinámico (Wi-Fi/LAN/NET) + valor a la derecha */}
      <box halign={Gtk.Align.FILL}>
        <label
          label={network.as((n) => {
            if (!n.isConnected) return "NET"
            return n.ssid ? "Wi-Fi" : "LAN"
          })}
          halign={Gtk.Align.START}
          hexpand={true}
          css={`color: ${theme['text-muted']}; min-width: ${sp(40)}px;`}
        />
        <label
          label={network.as((n) => {
            if (!n.isConnected) return "Desconectado"
            return n.ssid || "LAN"
          })}
          halign={Gtk.Align.END}
          css={`color: ${theme.text}; font-family: monospace;`}
        />
      </box>

      {/* IP row — solo el valor, alineado a la derecha (sin label "IP") */}
      <box spacing={sp(8)} halign={Gtk.Align.FILL}>
        <label
          label={network.as((n) => n.ip || "—")}
          halign={Gtk.Align.END}
          hexpand={true}
          css={`color: ${theme.text}; font-family: monospace;`}
        />
      </box>

      {/* Upload — solo el valor a la derecha, flecha ↑ al final */}
      <box halign={Gtk.Align.FILL}>
        <label
          label={network.as((n) => `${formatBytesPerSec(n.txBytesPerSec)}/s ↑`)}
          halign={Gtk.Align.END}
          hexpand={true}
          css={`color: ${theme.text}; font-family: monospace;`}
        />
      </box>

      {/* Download — solo el valor a la derecha, flecha ↓ al final */}
      <box halign={Gtk.Align.FILL}>
        <label
          label={network.as((n) => `${formatBytesPerSec(n.rxBytesPerSec)}/s ↓`)}
          halign={Gtk.Align.END}
          hexpand={true}
          css={`color: ${theme.text}; font-family: monospace;`}
        />
      </box>

      {/* Sparkline única de download — al final del widget, fuera de filas */}
      <Sparkline values={rxHistory} width={sparkW} height={sparkH} color={theme.accent} />
    </box>
  )
}