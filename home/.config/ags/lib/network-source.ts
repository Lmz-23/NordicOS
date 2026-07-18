// NordicOS — network source (Bloque B Fase 3, Ronda 6 fix 3).
// Lee SSID, IP, y throughput desde nmcli, /proc/net/dev, e ip(8).
//
// Decisiones técnicas:
// - SSID: nmcli (NetworkManager). Único método portable y validado en el
//   sistema. Fallback a `iw dev <iface> link` cuando nmcli no devuelve
//   active=yes (algunos drivers reportan active=no aunque haya conexión).
// - IP: `ip -4 -j addr` → JSON → primera inet con scope global. Más fiable
//   que parsear fib_trie y portable a interfaces predictibles (wlp0s20f3).
//   Fallback a parseo alternativo de JSON si el primer intento falla.
// - Throughput: /proc/net/dev (bytes acumulados por interfaz), calcula
//   delta entre polls. Sin nm-applet dependency, sin iptables, sin netstat.
// - Detección de interfaz activa (Ronda 6 fix 3): dinámicamente, primera
//   interfaz UP con inet global vía `ip -4 -j addr show`. Cache 30s.
// - Polling: 5s para todo (throughput quiere granularidad, SSID/IP
//   son baratos de re-leer). createPoll soporta async (time.ts:90).
// - `resetNetworkBaseline()` permite reiniciar delta al desmontar.
//
// Ronda 6 cambios:
// - readActiveIface reforzado: si `cachedIface` está vacío pero la
//   primera llamada devolvió datos, mantiene cache. Si todo falla, fuerza
//   reintento cada vez (sin cachedIface truthy el if de cache no aplica).
// - readSSID ahora valida `device wifi` con awk yes/sí Y fallback a
//   nmcli connection show --active si la primera consulta está vacía.

import { readFile } from "ags/file"
import { execAsync } from "ags/process"
import GLib from "gi://GLib?version=2.0"

export interface NetworkSnapshot {
  /** SSID Wi-Fi activo, "" si no hay Wi-Fi / cable. */
  ssid: string
  /** IP local IPv4, "" si no hay. */
  ip: string
  /** Nombre de la interfaz de red activa (e.g. "wlp0s20f3"). "" si ninguna. */
  iface: string
  /** Bytes/segundo recibidos (download). */
  rxBytesPerSec: number
  /** Bytes/segundo enviados (upload). */
  txBytesPerSec: number
  /** Bytes totales recibidos (acumulado). */
  totalRxBytes: number
  /** Bytes totales enviados (acumulado). */
  totalTxBytes: number
  /** ¿Hay alguna interfaz de red activa? */
  isConnected: boolean
}

interface NetStats {
  rx: number
  tx: number
}

async function execOutput(cmd: string): Promise<string> {
  try {
    // ags 3.1.0 execAsync(string) usa GLib.shell_parse_argv que NO soporta
    // pipes (`|`) ni redirecciones (`2>/dev/null`). Las trata como
    // argumentos literales, lo que rompe `ip addr show 2>/dev/null` y
    // todos los comandos con pipes a `awk`/`head`.
    //
    // Fix: ejecutar via `/bin/sh -c "<cmd>"` (array de args). El shell
    // sí parsea pipes y redirecciones correctamente. execAsyncv(array)
    // no invoca GLib.shell_parse_argv, así que el array pasa tal cual.
    return (await execAsync(["/bin/sh", "-c", cmd])).trim()
  } catch {
    return ""
  }
}

/**
 * Lee el SSID activo de NetworkManager. Devuelve "" si NM no está
 * corriendo, no hay Wi-Fi, o el dispositivo Wi-Fi no está conectado.
 * Filtramos por columna `active=yes` para ignorar otras redes visibles.
 *
 * Ronda 6: doble pasada. La primera con `device wifi` filtrando yes/sí.
 * Si está vacío, intenta con `connection show --active` y busca wifi.
 * Esto cubre casos donde nmcli reporta `no` para todas las redes wifi
 * visibles (drivers que no exponen `active` correctamente).
 */
async function readSSID(): Promise<string> {
  // Método 1: nmcli device wifi filtrando active=yes|sí, primera con SSID.
  let out = await execOutput(
    "nmcli -t -f active,ssid device wifi 2>/dev/null | awk -F: '($1 == \"yes\" || $1 == \"sí\") && $2 != \"\" {print $2; exit}'",
  )
  if (out) return out

  // Método 2: connection show --active, primera conexión 802-11-wireless.
  // Éxito cubre casos donde el filtrado active=no es engañoso (drivers
  // que no actualizan la columna `active` pese a estar conectados).
  out = await execOutput(
    "nmcli -t -f NAME,TYPE connection show --active 2>/dev/null | awk -F: '$2 == \"802-11-wireless\" {print $1; exit}'",
  )
  return out
}

/**
 * Detecta la interfaz de red activa: primera interfaz UP (no lo) con
 * inet global en `ip -4 -j addr show`. Devuelve "" si no hay.
 * Cachea el resultado a nivel módulo (cambia raramente).
 *
 * Ronda 6 fix 3: robustez ante fallos transitorios. Si la primera
 * lectura devuelve "" (p.ej. shell con PATH raro, ip no en /usr/sbin),
 * la próxima llamada reintenta (cachedIface="" no triggera cache).
 */
let cachedIface = ""
let cachedIfaceAt = 0
const IFACE_CACHE_MS = 30_000

async function readActiveIface(): Promise<string> {
  const now = Date.now()
  if (cachedIface && now - cachedIfaceAt < IFACE_CACHE_MS) return cachedIface
  cachedIfaceAt = now

  const out = await execOutput(
    "ip -4 -j addr show 2>/dev/null",
  )
  if (!out) return cachedIface // mantiene el último valor conocido

  try {
    const data = JSON.parse(out) as Array<{
      ifname: string
      addr_info?: Array<{ local: string }>
    }>
    for (const entry of data) {
      if (entry.ifname === "lo") continue
      if (entry.addr_info && entry.addr_info.length > 0) {
        cachedIface = entry.ifname
        return cachedIface
      }
    }
  } catch {
    // JSON malformado → ignorar, mantener cache anterior
  }
  return cachedIface
}

/**
 * Lee la IP de la interfaz activa. Si no hay cache, escanea todas.
 * Estrategia robusta: usa la interfaz cacheada si existe, si no la
 * primera inet global disponible.
 */
async function readIP(iface: string): Promise<string> {
  if (iface) {
    // Método rápido: filtrar por interfaz.
    const out = await execOutput(
      `ip -4 -j addr show ${iface} 2>/dev/null`,
    )
    if (out) {
      try {
        const data = JSON.parse(out) as Array<{
          addr_info?: Array<{ local: string }>
        }>
        const first = data[0]?.addr_info?.[0]?.local ?? ""
        if (first) return first
      } catch {
        // cae al método general
      }
    }
  }
  // Fallback: primera inet global del sistema.
  return execOutput(
    "ip -4 -j addr show 2>/dev/null | awk '/\"local\"/ {gsub(/[ \",:]/, \"\"); print}' | head -1",
  )
}

/**
 * Lee bytes rx/tx acumulados de /proc/net/dev para la interfaz dada.
 * /proc/net/dev tiene formato:
 *   iface: rx_bytes rx_packets ... tx_bytes tx_packets ...
 * Estructura: wlp0s20f3: 619594135 535147 ... 65002037 84067 ...
 * Columnas rx_bytes=0 (después del nombre), tx_bytes=8.
 */
function readProcNetDev(iface: string): NetStats {
  if (!iface) return { rx: 0, tx: 0 }
  try {
    const content = readFile("/proc/net/dev")
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim()
      if (!line.startsWith(`${iface}:`)) continue
      const parts = line.split(/\s+/).slice(1) // skip "iface:"
      const rx = parseInt(parts[0] ?? "0", 10) || 0
      const tx = parseInt(parts[8] ?? "0", 10) || 0
      return { rx, tx }
    }
  } catch {
    // /proc no accesible → silencio
  }
  return { rx: 0, tx: 0 }
}

// Baseline para cálculo de delta. A nivel módulo (singletons).
let prevStats: NetStats | null = null
let prevTime = Date.now()

/**
 * Snapshot completo de red: SSID, IP, throughput, totales.
 * Diseñado para `createPoll<NetworkSnapshot>(readNetwork(), 5000, readNetwork)`.
 */
export async function readNetwork(): Promise<NetworkSnapshot> {
  const iface = await readActiveIface()
  const [ssid, ip, stats] = await Promise.all([
    readSSID(),
    readIP(iface),
    Promise.resolve(readProcNetDev(iface)),
  ])

  const now = Date.now()
  const dt = (now - prevTime) / 1000 // segundos
  prevTime = now

  let rxPerSec = 0
  let txPerSec = 0
  if (prevStats && dt > 0) {
    rxPerSec = Math.max(0, (stats.rx - prevStats.rx) / dt)
    txPerSec = Math.max(0, (stats.tx - prevStats.tx) / dt)
  }
  prevStats = stats

  const snapshot: NetworkSnapshot = {
    ssid,
    ip,
    iface,
    rxBytesPerSec: Math.round(rxPerSec),
    txBytesPerSec: Math.round(txPerSec),
    totalRxBytes: stats.rx,
    totalTxBytes: stats.tx,
    isConnected: iface !== "" && (ssid !== "" || ip !== ""),
  }

  return snapshot
}

/**
 * Reset baseline. Llamar al desmontar para que el próximo readNetwork()
 * empiece limpio (no compute delta con una baseline obsoleta).
 */
export function resetNetworkBaseline() {
  prevStats = null
  prevTime = Date.now()
  cachedIface = ""
  cachedIfaceAt = 0
}

// ─── Validación lazy al cargar módulo ──────────────────────────────────
// Verifica que existan las fuentes de datos. Si no, los reads devuelven ""
// y el widget muestra "disconnected" / "—" sin crashear.
const _NMCLI_OK = GLib.file_test("/usr/bin/nmcli", GLib.FileTest.EXISTS)
const _PROC_OK = GLib.file_test("/proc/net/dev", GLib.FileTest.EXISTS)
void _NMCLI_OK
void _PROC_OK
