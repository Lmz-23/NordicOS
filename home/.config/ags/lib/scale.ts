// NordicOS — helper de escala por monitor (Ronda 11).
// Calcula un factor de escala basado en el monitor donde se renderiza
// el widget. Los widgets se ven "ENORMES" en monitores grandes (TV 4K/1080p)
// porque GTK/CSS usa píxeles fijos sin auto-scaling por monitor.
//
// Estrategia:
//   - Buscar el monitor más pequeño entre los activos (probablemente el
//     laptop, eDP-1 1366x768 en este hardware).
//   - Usar ese width como baseline → escala 1.0.
//   - Cualquier monitor más grande escala <1.0 proporcionalmente.
//   - Clamp [0.4, 1.0] para evitar widgets minúsculos en 4K.
//
// Comportamiento esperado en este hardware:
//   - eDP-1   1366px → 1.0  (laptop, sin cambio)
//   - HDMI-A-1 1920px → 0.71 (TV, reduce 29%)
//
// Notas:
//   - cachedScale: el primer cálculo se cachea para evitar recálculos
//     en cada poll de los widgets. Si el monitor cambia (hotplug),
//     hay que reiniciar ags — aceptable para NordicOS.
//   - get_scale_factor() del monitor se ignora porque ambos monitores
//     reportan scale=1.0; si en el futuro un monitor usa scale=1.5
//     (HiDPI), este factor debería multiplicarse.
//
// Decisiones:
//   - Gdk.Display.get_monitors() retorna GListModel (Gio API),
//     accedemos por get_item(i) + get_n_items().
//   - get_geometry() retorna una Gdk.Rectangle con width/height en
//     píxeles lógicos GTK (post-scale-factor), que es lo que queremos
//     para que el ratio sea independiente de HiDPI.

import Gdk from "gi://Gdk?version=4.0"

let cachedScale: number | null = null

export function getMonitorScale(): number {
  if (cachedScale !== null) return cachedScale

  try {
    const display = Gdk.Display.get_default()
    if (!display) {
      cachedScale = 1.0
      return 1.0
    }
    const monitors = display.get_monitors()
    if (!monitors || monitors.get_n_items() === 0) {
      cachedScale = 1.0
      return 1.0
    }

    // Encontrar el monitor más pequeño entre los activos.
    // Si solo hay un monitor, devolvemos 1.0 (sin scaling).
    let minWidth = Infinity
    const n = monitors.get_n_items()
    for (let i = 0; i < n; i++) {
      const monitor = monitors.get_item(i) as Gdk.Monitor
      if (!monitor) continue
      const geom = monitor.get_geometry()
      if (geom.width > 0 && geom.width < minWidth) {
        minWidth = geom.width
      }
    }
    if (n <= 1) {
      cachedScale = 1.0
      return 1.0
    }

    if (minWidth === Infinity || minWidth <= 0) {
      cachedScale = 1.0
      return 1.0
    }

    // Baseline: el monitor más pequeño (eDP-1 1366px) → 0.71.
    // Otros monitores escalan inversamente a su width vs referencia
    // "Full HD" (1920px). 4K (3840px) → 0.4 (clamp).
    //   - Monitor único activo → 1.0 (no necesita scaling).
    //   - Múltiples monitores (laptop + TV) → escala uniforme 0.71.
    //     Garantiza tamaño visual coherente entre monitores sin
    //     detección per-window (que requiere Gdk.Surface del window).
    const raw = minWidth / 1920
    cachedScale = Math.max(0.4, Math.min(1.0, raw))
    return cachedScale
  } catch {
    cachedScale = 1.0
    return 1.0
  }
}

/** Helper de conveniencia: aplica el factor a un valor en píxeles. */
export function sp(px: number): number {
  return Math.round(px * getMonitorScale())
}

/** Helper de conveniencia: aplica el factor a un font-size en em. */
export function se(em: number): string {
  return (em * getMonitorScale()).toFixed(2)
}