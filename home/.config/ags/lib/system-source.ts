// NordicOS — system source (Bloque B Fase 2).
// Lee CPU, RAM, y temperature desde /proc y /sys.
// Polling puro (sin side effects, sin caché mutable fuera de prevCpu).
//
// Decisiones técnicas:
// - `readFile` síncrono de ags/file (envuelve Gio.File.load_contents).
//   try/catch explícito en cada lectura: tolerar campos ausentes sin crashear.
// - `GLib.file_test` para detectar zonas térmicas antes de leer (cheapest check).
// - CPU usa técnica clásica de delta: lee /proc/stat dos veces, calcula
//   (totalDelta - idleDelta) / totalDelta. Mantiene prevCpu a nivel módulo.
// - `resetCpuBaseline()` permite reiniciar cuando el widget se desmonta
//   (evita que el primer percent tras remount sea erróneo).
// - Compatibilidad: createPoll<T>(init, interval, fn) con (prev) => fn() puro.

import { readFile } from "ags/file"
import GLib from "gi://GLib?version=2.0"

export interface CpuSnapshot {
  /** 0-100, porcentaje global de uso de CPU (todos los cores). */
  percent: number
  /** Por core (multi-core). Vacío por ahora — placeholder para Fase futura. */
  perCore: number[]
}

export interface MemorySnapshot {
  /** 0-100, usado / total. */
  percent: number
  /** GB usados. */
  usedGb: number
  /** GB totales. */
  totalGb: number
}

export interface TempSnapshot {
  /** Promedio de zonas térmicas (°C). */
  celsius: number
  /** Máximo entre zonas térmicas (°C). */
  maxCelsius: number
}

function readInt(path: string, fallback = 0): number {
  try {
    const content = readFile(path).trim()
    if (content === "") return fallback
    const n = parseInt(content, 10)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

/**
 * Lee la primera línea "cpu ..." de /proc/stat.
 * Devuelve total ticks y ticks idle (idle + iowait) acumulados.
 * Si /proc/stat no se puede leer, devuelve { total: 1, idle: 1 } para
 * evitar división por cero en readCpu().
 */
function readProcStat(): { total: number; idle: number } {
  try {
    const content = readFile("/proc/stat")
    const firstLine = content.split("\n", 1)[0] ?? ""
    // "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
    const parts = firstLine.split(/\s+/).slice(1)
    const user = parseInt(parts[0] ?? "0", 10) || 0
    const nice = parseInt(parts[1] ?? "0", 10) || 0
    const system = parseInt(parts[2] ?? "0", 10) || 0
    const idle = parseInt(parts[3] ?? "0", 10) || 0
    const iowait = parseInt(parts[4] ?? "0", 10) || 0
    const irq = parseInt(parts[5] ?? "0", 10) || 0
    const softirq = parseInt(parts[6] ?? "0", 10) || 0
    const steal = parseInt(parts[7] ?? "0", 10) || 0
    const total = user + nice + system + idle + iowait + irq + softirq + steal
    return { total, idle: idle + iowait }
  } catch {
    return { total: 1, idle: 1 }
  }
}

let prevCpu: { total: number; idle: number } | null = null

/**
 * Lee CPU usage global vía técnica delta entre dos lecturas consecutivas.
 * Primera llamada: sólo guarda baseline, percent = 0.
 * Segunda llamada en adelante: calcula el ratio.
 */
export function readCpu(): CpuSnapshot {
  const current = readProcStat()
  let percent = 0

  if (prevCpu) {
    const totalDelta = current.total - prevCpu.total
    const idleDelta = current.idle - prevCpu.idle
    percent = totalDelta > 0
      ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100)
      : 0
  }
  prevCpu = current

  return {
    percent: Math.max(0, Math.min(100, percent)),
    perCore: [],
  }
}

/**
 * Lee uso de RAM desde /proc/meminfo.
 * MemTotal y MemAvailable son las dos claves fiables; si MemAvailable
 * no existe (kernels muy viejos) cae a MemFree.
 */
export function readMemory(): MemorySnapshot {
  try {
    const content = readFile("/proc/meminfo")
    const fields: Record<string, number> = {}
    for (const line of content.split("\n")) {
      const colonIdx = line.indexOf(":")
      if (colonIdx < 0) continue
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      if (!key || !val) continue
      // "MemTotal:        8001200 kB" → primer token numérico.
      const numToken = val.split(/\s+/)[0] ?? ""
      fields[key] = parseInt(numToken, 10) || 0
    }

    const totalKb = fields["MemTotal"] ?? 0
    const availableKb = fields["MemAvailable"] ?? fields["MemFree"] ?? 0
    const usedKb = Math.max(0, totalKb - availableKb)
    const percent = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0

    return {
      percent: Math.max(0, Math.min(100, percent)),
      usedGb: usedKb / 1024 / 1024,
      totalGb: totalKb / 1024 / 1024,
    }
  } catch {
    return { percent: 0, usedGb: 0, totalGb: 0 }
  }
}

/**
 * Lee temperaturas de /sys/class/thermal/thermal_zone[N]/temp (en mili-grados C).
 * Promedia todas las zonas válidas; reporta también el máximo.
 * Si la carpeta no existe (p.ej. contenedor sin thermal sysfs), devuelve 0/0.
 */
export function readTemp(): TempSnapshot {
  try {
    const dir = "/sys/class/thermal"
    if (!GLib.file_test(dir, GLib.FileTest.EXISTS)) {
      return { celsius: 0, maxCelsius: 0 }
    }

    let totalC = 0
    let maxC = 0
    let count = 0

    // thermal_zone0, thermal_zone1, ... hasta 20 (más que suficiente).
    for (let i = 0; i < 20; i++) {
      const path = `${dir}/thermal_zone${i}/temp`
      if (!GLib.file_test(path, GLib.FileTest.EXISTS)) continue
      const milliC = readInt(path, 0)
      const c = milliC / 1000
      totalC += c
      if (c > maxC) maxC = c
      count++
    }

    return {
      celsius: count > 0 ? Math.round(totalC / count) : 0,
      maxCelsius: Math.round(maxC),
    }
  } catch {
    return { celsius: 0, maxCelsius: 0 }
  }
}

/**
 * Reinicia la baseline de CPU. Llamar cuando el widget se desmonta para
 * que el siguiente readCpu() empiece desde cero (no compute delta con
 * una baseline obsoleta).
 */
export function resetCpuBaseline() {
  prevCpu = null
}