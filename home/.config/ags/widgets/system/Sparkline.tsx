// NordicOS — Sparkline (Bloque B Fase 2).
// Sub-componente Cairo que dibuja una polyline histórica.
// Patrón basado en ags-test/widget/frame/FrameDrawing.tsx (validado).
//
// Decisiones técnicas:
// - `drawingarea` con `$={(da) => da.set_draw_func(...)}` — patrón gtk4 validado.
// - Se suscribe a un accessor reactivo (`Accessor<number[]>`) y llama
//   `queue_draw()` en cada cambio. Sin esto, el dibujo es estático.
// - Color se aplica como hex (#RRGGBB) parseado a RGBA en el drawFunc.
// - Si `values` tiene < 2 puntos, no dibuja nada (evita línea degenerada).
// - `queueResize` se llama al montar para forzar el primer layout/paint.

import { Gtk } from "ags/gtk4"
import Cairo from "gi://cairo?version=1.0"
import { Accessor, onCleanup } from "ags"

interface Props {
  /** Array reactivo de valores 0-100, más reciente al final. */
  values: Accessor<number[]>
  /** Ancho en px. Default 80. */
  width?: number
  /** Alto en px. Default 24. */
  height?: number
  /** Color de la línea en formato hex #RRGGBB. Default theme.accent. */
  color?: string
}

/** Convierte #RRGGBB a [r, g, b, a] en 0..1. Tolerante a input inválido. */
function hexToRgba(hex: string): [number, number, number, number] {
  const fallback: [number, number, number, number] = [0.47, 0.78, 1.0, 1.0]
  if (!hex || hex[0] !== "#" || hex.length < 7) return fallback
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return fallback
  }
  return [r / 255, g / 255, b / 255, 1.0]
}

export function Sparkline({ values, width = 80, height = 24, color = "#78c7ff" }: Props) {
  // Parseamos color una sola vez (es estático en este widget).
  const [r, g, b, a] = hexToRgba(color)

  return (
    <drawingarea
      widthRequest={width}
      heightRequest={height}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
      $={(self: Gtk.DrawingArea) => {
        // Forzar tamaño de paint surface explícito (defensa contra layout 0).
        self.set_content_width(width)
        self.set_content_height(height)

        // Draw func — se invoca cada vez que queue_draw() es llamado.
        self.set_draw_func((_area, cr: Cairo.Context, w: number, h: number) => {
          const data = values.peek()
          if (data.length < 2) return

          // Normalizar rango: si todo es 0, dibujamos línea base al fondo.
          const max = Math.max(...data, 100)
          const min = Math.min(...data, 0)
          const range = Math.max(1, max - min)
          const step = w / (data.length - 1)

          cr.setSourceRGBA(r, g, b, a)
          cr.setLineWidth(1.5)
          cr.setLineCap(Cairo.LineCap.ROUND)
          cr.setLineJoin(Cairo.LineJoin.ROUND)

          // Polyline: empezamos en el primer punto, conectamos el resto.
          for (let i = 0; i < data.length; i++) {
            const x = i * step
            const y = h - ((data[i] - min) / range) * h
            if (i === 0) {
              cr.moveTo(x, y)
            } else {
              cr.lineTo(x, y)
            }
          }
          cr.stroke()
        })

        // Subscripción reactiva: cada cambio en values dispara repaint.
        // onCleanup garantiza unsub cuando el widget se destruye.
        const unsub = values.subscribe(() => {
          self.queue_draw()
        })
        onCleanup(unsub)
      }}
    />
  )
}