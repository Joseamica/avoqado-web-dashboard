import { normalizeFormFactor, type DeviceFormFactorKey } from '@/lib/device-kind'
import { TERMINAL_ONLINE_THRESHOLD_MS } from '@/lib/terminal-status'

/**
 * Cómo se PRESENTA cada dispositivo en la lista de Dispositivos (rediseño 8-oct-2026,
 * maqueta A1: una sola tabla al estilo Square con columna «Sistema»).
 *
 * Son funciones puras para que las reglas se prueben sin montar la página. Cada una lee
 * los campos crudos que el server ya manda en `GET /dashboard/venues/:id/tpvs` (la fila
 * completa de `Terminal`, sin `select`), así que no hace falta cambiar el server.
 */
export interface DeviceListInput {
  type?: string | null
  status?: string | null
  isLocked?: boolean | null
  lastHeartbeat?: string | null
  formFactor?: string | null
  osVersion?: string | null
  modelIdentifier?: string | null
  model?: string | null
  brand?: string | null
  version?: string | null
  serialNumber?: string | null
  deviceUid?: string | null
  systemInfo?: unknown
}

// ── Rol ────────────────────────────────────────────────────────────────────────

/** TPV_* = terminal de COBRO (PAX/NEXGO con SDK bancario). POS_* = la app POS en hardware genérico. */
export function isPaymentTerminal(device: Pick<DeviceListInput, 'type'>): boolean {
  return device.type === 'TPV_ANDROID' || device.type === 'TPV_IOS'
}

export type DeviceRole = 'paymentTerminal' | 'pointOfSale' | 'printer' | 'kitchenDisplay' | 'other'

export function getDeviceRole(device: Pick<DeviceListInput, 'type'>): DeviceRole {
  switch (device.type) {
    case 'TPV_ANDROID':
    case 'TPV_IOS':
      return 'paymentTerminal'
    case 'POS_ANDROID':
    case 'POS_IOS':
    case 'POS_DESKTOP':
      return 'pointOfSale'
    case 'PRINTER_RECEIPT':
    case 'PRINTER_KITCHEN':
      return 'printer'
    case 'KDS':
      return 'kitchenDisplay'
    default:
      return 'other'
  }
}

// ── Sistema operativo ──────────────────────────────────────────────────────────

export type DeviceSystem = 'android' | 'ios' | 'windows' | 'unknown'

export interface DeviceSystemInfo {
  system: DeviceSystem
  /** Texto listo para pintar: «Android 14», «iOS 18.6», «iPadOS 18.5», «Windows 11», «Android». */
  label: string | null
  /** true ⇒ la celda antepone la etiqueta «TPV». */
  isPaymentTerminal: boolean
}

function readSystemInfo(device: DeviceListInput): Record<string, unknown> {
  return device.systemInfo && typeof device.systemInfo === 'object' ? (device.systemInfo as Record<string, unknown>) : {}
}

function rawOsVersion(device: DeviceListInput): string | null {
  if (device.osVersion?.trim()) return device.osVersion.trim()
  // Las TPV mandan su sistema dentro del heartbeat (`Terminal.systemInfo.osVersion`), no en la columna.
  const fromHeartbeat = readSystemInfo(device).osVersion
  return typeof fromHeartbeat === 'string' && fromHeartbeat.trim() ? fromHeartbeat.trim() : null
}

/**
 * La caja de Windows es la app de ANDROID corriendo en la PC: se registra como
 * `POS_ANDROID` con `osVersion: "Android 14"`. Lo que la delata es el modelo («Windows 11»)
 * y el sabor de la versión («2.20.1-escritorio»). Sin esto la columna diría «Android».
 */
function looksLikeWindows(device: DeviceListInput): boolean {
  if (device.type === 'POS_DESKTOP') return true
  if (/windows/i.test(device.modelIdentifier ?? '') || /windows/i.test(device.model ?? '')) return true
  return /-escritorio$/i.test(device.version ?? '')
}

export function getDeviceSystem(device: DeviceListInput): DeviceSystemInfo {
  const paymentTerminal = isPaymentTerminal(device)
  const os = rawOsVersion(device)

  if (looksLikeWindows(device)) {
    const source = `${device.modelIdentifier ?? ''} ${device.model ?? ''}`
    const major = source.match(/windows\s*(\d+)/i)?.[1]
    return { system: 'windows', label: major ? `Windows ${major}` : 'Windows', isPaymentTerminal: paymentTerminal }
  }

  const iosByType = device.type === 'POS_IOS' || device.type === 'TPV_IOS'
  const iosMatch = os?.match(/^(iPadOS|iOS)\s*([\d.]+)?/i)
  if (iosByType || iosMatch) {
    const name = iosMatch?.[1] ? (iosMatch[1].toLowerCase() === 'ipados' ? 'iPadOS' : 'iOS') : 'iOS'
    const ver = iosMatch?.[2]
    return { system: 'ios', label: ver ? `${name} ${ver}` : name, isPaymentTerminal: paymentTerminal }
  }

  const androidByType = device.type === 'POS_ANDROID' || device.type === 'TPV_ANDROID'
  if (androidByType || /android/i.test(os ?? '')) {
    // «Android XAP OS V1.0» (sistema propio de NEXGO) no trae un número de Android: sólo «Android».
    const ver = os?.match(/android\s+(\d+(?:\.\d+)?)\b/i)?.[1]
    return { system: 'android', label: ver ? `Android ${ver}` : 'Android', isPaymentTerminal: paymentTerminal }
  }

  return { system: 'unknown', label: os, isPaymentTerminal: paymentTerminal }
}

// ── Clase de aparato (ícono) ──────────────────────────────────────────────────

/**
 * Las TPV dadas de alta por admin no traen `formFactor` (null ⇒ UNKNOWN ⇒ ícono «?»).
 * Su tipo ya dice qué son: una terminal de cobro de mano.
 */
export function getDeviceKind(device: DeviceListInput): DeviceFormFactorKey {
  if (looksLikeWindows(device)) return 'DESKTOP'
  const kind = normalizeFormFactor(device.formFactor)
  if (kind === 'UNKNOWN' && isPaymentTerminal(device)) return 'HANDHELD_POS'
  return kind
}

// ── Batería ────────────────────────────────────────────────────────────────────

export interface DeviceBattery {
  level: number
  charging: boolean
  low: boolean
}

export const LOW_BATTERY_PERCENT = 20

/** Hoy sólo las TPV mandan batería (heartbeat → `systemInfo`). Los POS de Android/iOS todavía no. */
export function getDeviceBattery(device: DeviceListInput): DeviceBattery | null {
  const info = readSystemInfo(device)
  const level = info.batteryLevel
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 0 || level > 100) return null
  const rounded = Math.round(level)
  return { level: rounded, charging: info.batteryCharging === true, low: rounded <= LOW_BATTERY_PERCENT }
}

// ── Versión de la app ─────────────────────────────────────────────────────────

/** «2.12.2-nexgo-prod» ⇒ corta «2.12.2» (la completa va en el tooltip). */
export function getAppVersion(device: Pick<DeviceListInput, 'version'>): { short: string; full: string } | null {
  const full = device.version?.trim()
  if (!full) return null
  const short = full.replace(/^v/i, '').split('-')[0]
  return { short: short || full, full }
}

// ── Identificador ─────────────────────────────────────────────────────────────

export interface DeviceIdentifier {
  /** Lo que se pinta: completo si es corto (AVQD-N860W173400), recortado si es un uuid. */
  display: string
  /** Lo que se copia. */
  full: string
  kind: 'serial' | 'deviceUid'
}

const MAX_FULL_LENGTH = 18

function shorten(value: string): string {
  if (value.length <= MAX_FULL_LENGTH) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

/** Serie si el aparato la da (PAX, NEXGO, Sunmi); si no, el `deviceUid` (iPhone nunca da serie). */
export function getDeviceIdentifier(device: DeviceListInput): DeviceIdentifier | null {
  const serial = device.serialNumber?.trim()
  if (serial) return { display: shorten(serial), full: serial, kind: 'serial' }
  const uid = device.deviceUid?.trim()
  if (uid) return { display: shorten(uid), full: uid, kind: 'deviceUid' }
  return null
}

// ── Estado ────────────────────────────────────────────────────────────────────

export type DeviceListStatusKey = 'locked' | 'pendingActivation' | 'retired' | 'maintenance' | 'online' | 'offline' | 'neverConnected'
export type DeviceStatusTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info'

export interface LastSeen {
  unit: 'justNow' | 'minutes' | 'hours' | 'days'
  count: number
}

export interface DeviceListStatus {
  key: DeviceListStatusKey
  tone: DeviceStatusTone
  /** Sólo en `offline`: hace cuánto habló por última vez. */
  lastSeen: LastSeen | null
}

/** Sin conexión por más de esto ⇒ el pill se pinta en ámbar: alguien debería revisarlo. */
export const STALE_AFTER_DAYS = 7

export function getLastSeen(lastHeartbeat: string | null | undefined, now: number): LastSeen | null {
  if (!lastHeartbeat) return null
  const then = new Date(lastHeartbeat).getTime()
  if (!Number.isFinite(then)) return null
  const diffMs = Math.max(0, now - then)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return { unit: 'justNow', count: 0 }
  if (minutes < 60) return { unit: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', count: hours }
  return { unit: 'days', count: Math.floor(hours / 24) }
}

/**
 * Un solo pill que responde «¿está funcionando?».
 *
 * 🔴 `INACTIVE` NO cuenta como estado: lo pone el server solo cuando un aparato no manda su
 * heartbeat de salud en 2 min (`auth.tpv.service.ts`), y los POS de Android no lo mandan
 * aunque estén vendiendo. Antes ganaba sobre la conexión y salía «Inactivo» junto a
 * «Última conexión: Ahora». La conexión se decide por `lastHeartbeat`, que los POS sí
 * actualizan en cada request.
 */
export function getDeviceListStatus(device: DeviceListInput, now: number = Date.now()): DeviceListStatus {
  if (device.isLocked) return { key: 'locked', tone: 'danger', lastSeen: null }

  switch (device.status) {
    case 'PENDING_ACTIVATION':
      return { key: 'pendingActivation', tone: 'warning', lastSeen: null }
    case 'RETIRED':
      return { key: 'retired', tone: 'neutral', lastSeen: null }
    case 'MAINTENANCE':
      return { key: 'maintenance', tone: 'info', lastSeen: null }
  }

  const lastSeen = getLastSeen(device.lastHeartbeat, now)
  if (!lastSeen) return { key: 'neverConnected', tone: 'neutral', lastSeen: null }

  const ageMs = now - new Date(device.lastHeartbeat as string).getTime()
  if (ageMs >= 0 && ageMs < TERMINAL_ONLINE_THRESHOLD_MS) return { key: 'online', tone: 'success', lastSeen: null }

  const stale = lastSeen.unit === 'days' && lastSeen.count >= STALE_AFTER_DAYS
  return { key: 'offline', tone: stale ? 'warning' : 'neutral', lastSeen }
}
