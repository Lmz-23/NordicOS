// NordicOS — battery source from sysfs + upower fallback (Ronda 11).
// Lee /sys/class/power_supply/BAT0/ que upower también usa.
// Estrategia: usar readFile síncrono de ags/file (envuelve Gio.File.load_contents)
// y try/catch explícito en cada lectura para tolerar campos ausentes.
//
// Cambio Ronda 11:
// - Añadido fallback a `upower -i /org/freedesktop/UPower/devices/battery_BAT0`
//   para `time_to_empty_now` y `time_to_full_now` cuando sysfs devuelve 0.
//   En este hardware (CPT-COS L16C2PB2), sysfs NO expone `time_to_empty_now`
//   durante descarga — siempre 0. upower SÍ lo expone cuando hay consumo real.
// - Función convertida a async (`readBattery(): Promise<BatteryStatus>`)
//   porque upower es subprocess. BatteryWidget ya usa createPoll con fn async
//   (mismo patrón que NetworkWidget).
// - Cache en upower: solo se invoca si sysfs devuelve 0, para minimizar
//   el coste (subprocess ~30ms). En estado "fully-charged" ni siquiera
//   entra al fallback (sysfs time_to_empty_now=0 pero el status es "Full"
//   → no necesitamos tiempo de descarga).
// - Si upower no está disponible o falla, fallback silencioso a 0.
//
// Cambio Ronda 11+:
// - Tercer fallback: si ni sysfs ni upower dan tiempo (este HW a veces
//   tampoco expone power_now cuando idle/Full, pero SÍ durante carga/descarga
//   activa), calculamos desde energy_now/energy_full/power_now (mismas
//   unidades µWh/µW) → horas → minutos. Se aplica solo a estados activos
//   (Charging/Discharging). Confía en el label del widget para mostrar
//   "Cargado" cuando Full (donde power_now=0 y la fórmula no aplica).

import { readFile } from "ags/file"
import { execAsync } from "ags/process"
import GLib from "gi://GLib?version=2.0"

export interface BatteryStatus {
  present: boolean
  capacity: number // 0-100
  status: "Charging" | "Discharging" | "Full" | "Unknown"
  energyNow: number // µWh
  energyFull: number // µWh
  energyFullDesign: number // µWh
  powerNow: number // µW
  voltageNow: number // µV
  cycleCount: number
  timeToEmpty: number // minutes, -1 if unknown
  timeToFull: number // minutes, -1 if unknown
}

const BAT0 = "/sys/class/power_supply/BAT0"
const UPOWER_PATH = "/org/freedesktop/UPower/devices/battery_BAT0"

function readInt(path: string): number {
  try {
    const content = readFile(path)
    const trimmed = content.trim()
    if (trimmed === "") return 0
    const n = parseInt(trimmed, 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function readStatus(): BatteryStatus["status"] {
  try {
    const status = readFile(`${BAT0}/status`).trim()
    if (status === "Charging") return "Charging"
    if (status === "Discharging") return "Discharging"
    // "Not charging" = AC conectado pero batería no carga (laptop docked).
    // Lo tratamos como Full si capacity >= 100, sino como Discharging.
    if (status === "Not charging") return "Discharging"
    if (status === "Full") return "Full"
    return "Unknown"
  } catch {
    return "Unknown"
  }
}

/**
 * Parsea la salida de `upower -i ...` buscando líneas
 *   "    time to empty: 1.5 hours"
 *   "    time to full: 15.6 minutes"
 * Devuelve minutos (redondeados). Si upower no está, retorna 0/0.
 *
 * upower expone time to empty SOLO cuando el estado es discharging
 * (no cuando fully-charged). time to full SOLO cuando charging.
 *
 * Usa execAsync(array) de ags/process (mismo patrón que network-source.ts)
 * en lugar de GLib.Subprocess manual — más simple y consistente.
 *
 * Locale: upower en es_ES usa coma decimal ("15,8 minutes"); parseFloat
 * lo trunca en la coma. Forzamos LC_ALL=C en el subprocess para output
 * uniforme con punto decimal.
 *
 * Unidad: upower CLI formatea humanamente (minutes/seconds/hours).
 *   - < 1 min → "X.X seconds"  (ej: 30 seconds)
 *   - < 1 hr  → "X.X minutes"  (ej: 15.6 minutes)
 *   - >= 1 hr → "X.X hours"    (ej: 2.5 hours)
 * Devuelve el valor ya en MINUTOS (no multiplicar).
 */

/**
 * Cálculo alternativo cuando ni sysfs ni upower exponen tiempo.
 *
 * Unidades sysfs (verificadas en /sys/class/power_supply/BAT0):
 *   - power_now      µW (microwatts)
 *   - energy_now     µWh (microwatt-hours)
 *   - energy_full    µWh (microwatt-hours)
 *
 * Discharging:  t(horas) = energy_now / power_now         → t * 60 = minutos
 * Charging:     t(horas) = (energy_full - energy_now)
 *                                  / power_now             → t * 60 = minutos
 *
 * Caveats:
 * - power_now=0 cuando Full o sin consumo → división inválida, retornamos 0.
 * - Necesitamos energía y potencia en magnitudes consistentes; al estar
 *   ambas en µW/µWh, el ratio es directamente horas.
 * - energyFull=0 sería batería vacía/ausente → evitamos división por 0.
 * - Diferencia energy_full - energy_now puede ser negativa brevemente durante
 *   recalibración → si < 0 devolvemos 0.
 *
 * Devuelve minutes redondeados, o 0 si los datos no permiten cálculo fiable.
 */
function readTimeFromEnergy(
  energyNow: number,
  energyFull: number,
  powerNow: number,
  status: BatteryStatus["status"],
): { timeToEmpty: number; timeToFull: number } {
  let timeToEmpty = 0
  let timeToFull = 0
  if (powerNow <= 0) return { timeToEmpty, timeToFull }

  if (status === "Discharging" && energyNow > 0) {
    // µWh / µW = horas
    const hours = energyNow / powerNow
    if (Number.isFinite(hours) && hours > 0) {
      timeToEmpty = Math.round(hours * 60)
    }
  } else if (status === "Charging" && energyFull > 0 && energyNow >= 0) {
    const remaining = energyFull - energyNow
    if (remaining > 0) {
      const hours = remaining / powerNow
      if (Number.isFinite(hours) && hours > 0) {
        timeToFull = Math.round(hours * 60)
      }
    }
  }
  return { timeToEmpty, timeToFull }
}

async function readTimeUpower(): Promise<{ timeToEmpty: number; timeToFull: number }> {
  let out = ""
  try {
    out = (await execAsync([
      "/bin/sh",
      "-c",
      `LC_ALL=C upower -i ${UPOWER_PATH} 2>/dev/null`,
    ])).trim()
  } catch {
    return { timeToEmpty: 0, timeToFull: 0 }
  }

  let timeToEmpty = 0
  let timeToFull = 0
  for (const line of out.split("\n")) {
    // Extrae "X.X unit" tras los dos puntos.
    // Ejemplos parseados:
    //   "    time to full:        15.6 minutes"
    //   "    time to empty:       0.0 hours"
    //   "    time to empty:       30 seconds"
    const m = line.match(/(?:time to (?:empty|full)):\s*([\d.]+)\s+(\w+)/)
    if (!m) continue
    const val = parseFloat(m[1])
    if (!Number.isFinite(val) || val <= 0) continue
    const unit = m[2].toLowerCase()
    let mins = val
    if (unit.startsWith("hour")) mins = val * 60
    else if (unit.startsWith("second")) mins = val / 60
    // minutes: ya está en minutos, no convertir
    const rounded = Math.round(mins)
    if (line.includes("time to empty:")) timeToEmpty = rounded
    else if (line.includes("time to full:")) timeToFull = rounded
  }
  return { timeToEmpty, timeToFull }
}

export async function readBattery(): Promise<BatteryStatus> {
  const present = GLib.file_test(BAT0, GLib.FileTest.EXISTS)
  if (!present) {
    return {
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
  }

  const capacity = readInt(`${BAT0}/capacity`)
  const status = readStatus()
  // Leemos power/energy antes que time_* porque el fallback Ronda 11+
  // puede necesitarlos para estimar tiempo cuando upower no expone nada.
  const energyNow = readInt(`${BAT0}/energy_now`)
  const energyFull = readInt(`${BAT0}/energy_full`)
  const powerNow = readInt(`${BAT0}/power_now`)
  let timeToEmpty = readInt(`${BAT0}/time_to_empty_now`)
  let timeToFull = readInt(`${BAT0}/time_to_full_now`)

  // Ronda 11: si sysfs devuelve 0 (este HW no expone time_to_empty_now),
  // intentar con upower. Solo para estados donde el tiempo tiene sentido
  // (no preguntar si está Full).
  if (timeToEmpty === 0 && timeToFull === 0 && status !== "Full" && status !== "Unknown") {
    const up = await readTimeUpower()
    if (up.timeToEmpty > 0) timeToEmpty = up.timeToEmpty
    if (up.timeToFull > 0) timeToFull = up.timeToFull
  }

  // Ronda 11+: si ni sysfs ni upower dan tiempo válido, estimación local
  // desde power_now/energy_now (energy_full). Solo estados activos;
  // cuando Full/Unknown power_now=0 y la fórmula degenera.
  if (powerNow > 0 && status !== "Full" && status !== "Unknown") {
    const stillMissing =
      (status === "Discharging" && timeToEmpty <= 0) ||
      (status === "Charging" && timeToFull <= 0)
    if (stillMissing) {
      const est = readTimeFromEnergy(energyNow, energyFull, powerNow, status)
      if (status === "Discharging" && est.timeToEmpty > 0) timeToEmpty = est.timeToEmpty
      if (status === "Charging" && est.timeToFull > 0) timeToFull = est.timeToFull
    }
  }

  return {
    present: true,
    capacity,
    status,
    energyNow,
    energyFull,
    energyFullDesign: readInt(`${BAT0}/energy_full_design`),
    powerNow,
    voltageNow: readInt(`${BAT0}/voltage_now`),
    cycleCount: readInt(`${BAT0}/cycle_count`),
    timeToEmpty,
    timeToFull,
  }
}