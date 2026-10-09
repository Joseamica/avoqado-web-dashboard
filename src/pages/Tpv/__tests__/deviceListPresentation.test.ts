import { describe, expect, it } from 'vitest'

import {
  getActivationRoute,
  getAppVersion,
  getDeviceBattery,
  getDeviceIdentifier,
  getDeviceKind,
  getDeviceListStatus,
  getDeviceRole,
  getDeviceSystem,
  getLastSeen,
} from '../deviceListPresentation'

const NOW = new Date('2026-10-08T20:00:00.000Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('getDeviceSystem — columna «Sistema»', () => {
  it('la caja de Windows se registra como Android 14 y aun así dice Windows 11', () => {
    // Fila real de la base local: la app de Android corriendo en la PC.
    const windowsPos = {
      type: 'POS_ANDROID',
      osVersion: 'Android 14',
      formFactor: 'TABLET',
      modelIdentifier: 'Windows 11',
      brand: 'Avoqado',
      model: 'Avoqado Windows 11',
      version: '2.20.1-escritorio',
    }
    expect(getDeviceSystem(windowsPos)).toEqual({ system: 'windows', label: 'Windows 11', isPaymentTerminal: false })
  })

  it('reconoce Windows sólo por el sabor «-escritorio» de la versión', () => {
    expect(getDeviceSystem({ type: 'POS_ANDROID', osVersion: 'Android 14', version: '2.22.3-escritorio' }).system).toBe('windows')
  })

  it('la TPV toma su sistema del heartbeat y se marca como terminal de cobro', () => {
    const pax = { type: 'TPV_ANDROID', osVersion: null, systemInfo: { osVersion: 'Android 10', batteryLevel: 50 } }
    expect(getDeviceSystem(pax)).toEqual({ system: 'android', label: 'Android 10', isPaymentTerminal: true })
  })

  it('NEXGO con su sistema propio («Android XAP OS V1.0») dice sólo «Android»', () => {
    const nexgo = { type: 'TPV_ANDROID', systemInfo: { osVersion: 'Android XAP OS V1.0' } }
    expect(getDeviceSystem(nexgo)).toEqual({ system: 'android', label: 'Android', isPaymentTerminal: true })
  })

  it('iPhone e iPad conservan el nombre de su sistema', () => {
    expect(getDeviceSystem({ type: 'POS_IOS', osVersion: 'iOS 18.6' }).label).toBe('iOS 18.6')
    expect(getDeviceSystem({ type: 'POS_IOS', osVersion: 'iPadOS 18.5' }).label).toBe('iPadOS 18.5')
  })

  it('un POS de iOS sin versión reportada dice «iOS»', () => {
    expect(getDeviceSystem({ type: 'POS_IOS', osVersion: null })).toEqual({ system: 'ios', label: 'iOS', isPaymentTerminal: false })
  })

  it('una impresora sin sistema no inventa uno', () => {
    expect(getDeviceSystem({ type: 'PRINTER_RECEIPT' })).toEqual({ system: 'unknown', label: null, isPaymentTerminal: false })
  })
})

describe('getDeviceKind — ícono del aparato', () => {
  it('una TPV sin formFactor ya no cae en «desconocido» (el «?» de la lista vieja)', () => {
    expect(getDeviceKind({ type: 'TPV_ANDROID', formFactor: null })).toBe('HANDHELD_POS')
  })

  it('la caja de Windows se dibuja como computadora aunque diga TABLET', () => {
    expect(getDeviceKind({ type: 'POS_ANDROID', formFactor: 'TABLET', modelIdentifier: 'Windows 11' })).toBe('DESKTOP')
  })

  it('respeta el formFactor reportado', () => {
    expect(getDeviceKind({ type: 'POS_IOS', formFactor: 'PHONE' })).toBe('PHONE')
    expect(getDeviceKind({ type: 'POS_ANDROID', formFactor: 'COUNTERTOP_POS' })).toBe('COUNTERTOP_POS')
  })
})

describe('getDeviceRole', () => {
  it('separa terminal de cobro de punto de venta', () => {
    expect(getDeviceRole({ type: 'TPV_ANDROID' })).toBe('paymentTerminal')
    expect(getDeviceRole({ type: 'POS_ANDROID' })).toBe('pointOfSale')
    expect(getDeviceRole({ type: 'POS_DESKTOP' })).toBe('pointOfSale')
    expect(getDeviceRole({ type: 'KDS' })).toBe('kitchenDisplay')
    expect(getDeviceRole({ type: 'PRINTER_KITCHEN' })).toBe('printer')
  })
})

describe('getDeviceBattery', () => {
  it('lee la batería del heartbeat de la TPV', () => {
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 76, batteryCharging: true } })).toEqual({ level: 76, charging: true, low: false })
  })

  it('marca batería baja en 20 % o menos', () => {
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 13 } })).toEqual({ level: 13, charging: false, low: true })
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 20 } })?.low).toBe(true)
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 21 } })?.low).toBe(false)
  })

  it('sin dato (los POS de Android/iOS todavía no la mandan) devuelve null, no 0 %', () => {
    expect(getDeviceBattery({ systemInfo: null })).toBeNull()
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 'unknown' } })).toBeNull()
    expect(getDeviceBattery({})).toBeNull()
  })

  it('descarta valores imposibles', () => {
    expect(getDeviceBattery({ systemInfo: { batteryLevel: 140 } })).toBeNull()
    expect(getDeviceBattery({ systemInfo: { batteryLevel: -1 } })).toBeNull()
  })
})

describe('getAppVersion', () => {
  it('corta el sabor de la versión y conserva la completa', () => {
    expect(getAppVersion({ version: '2.12.2-nexgo-prod' })).toEqual({ short: '2.12.2', full: '2.12.2-nexgo-prod' })
    expect(getAppVersion({ version: '1.14.0' })).toEqual({ short: '1.14.0', full: '1.14.0' })
  })

  it('sin versión no pinta nada', () => {
    expect(getAppVersion({ version: null })).toBeNull()
    expect(getAppVersion({ version: '  ' })).toBeNull()
  })
})

describe('getDeviceIdentifier — columna «ID»', () => {
  it('la serie de una TPV se muestra completa', () => {
    expect(getDeviceIdentifier({ serialNumber: 'AVQD-N860W173400' })).toEqual({
      display: 'AVQD-N860W173400',
      full: 'AVQD-N860W173400',
      kind: 'serial',
    })
  })

  it('el iPhone no da serie: usa el deviceUid recortado y copia el completo', () => {
    const uid = '37B06327-D122-47EF-8C0A-D62BBE0E92EE'
    expect(getDeviceIdentifier({ serialNumber: null, deviceUid: uid })).toEqual({ display: '37B06327…92EE', full: uid, kind: 'deviceUid' })
  })

  it('sin ninguno de los dos, no hay ID', () => {
    expect(getDeviceIdentifier({})).toBeNull()
  })
})

describe('getDeviceListStatus — un solo pill de estado', () => {
  it('en línea si habló en los últimos 5 min', () => {
    expect(getDeviceListStatus({ status: 'ACTIVE', lastHeartbeat: ago(2 * MIN) }, NOW)).toEqual({ key: 'online', tone: 'success', lastSeen: null })
  })

  it('🔴 el Sunmi marcado INACTIVE por el server pero usado ahorita sale EN LÍNEA (antes: «Inactivo» + «Ahora»)', () => {
    expect(getDeviceListStatus({ status: 'INACTIVE', lastHeartbeat: ago(10_000) }, NOW).key).toBe('online')
  })

  it('sin conexión dice hace cuánto', () => {
    expect(getDeviceListStatus({ status: 'ACTIVE', lastHeartbeat: ago(2 * HOUR) }, NOW)).toEqual({
      key: 'offline',
      tone: 'neutral',
      lastSeen: { unit: 'hours', count: 2 },
    })
  })

  it('más de 7 días sin conexión se pinta en ámbar', () => {
    expect(getDeviceListStatus({ status: 'ACTIVE', lastHeartbeat: ago(56 * DAY) }, NOW)).toEqual({
      key: 'offline',
      tone: 'warning',
      lastSeen: { unit: 'days', count: 56 },
    })
    expect(getDeviceListStatus({ status: 'ACTIVE', lastHeartbeat: ago(6 * DAY) }, NOW).tone).toBe('neutral')
  })

  it('nunca conectado', () => {
    expect(getDeviceListStatus({ status: 'ACTIVE', lastHeartbeat: null }, NOW).key).toBe('neverConnected')
  })

  it('bloqueo, activación pendiente, retiro y mantenimiento ganan sobre la conexión', () => {
    const recent = ago(MIN)
    expect(getDeviceListStatus({ status: 'ACTIVE', isLocked: true, lastHeartbeat: recent }, NOW).key).toBe('locked')
    expect(getDeviceListStatus({ status: 'PENDING_ACTIVATION', lastHeartbeat: recent }, NOW).key).toBe('pendingActivation')
    expect(getDeviceListStatus({ status: 'RETIRED', lastHeartbeat: recent }, NOW).key).toBe('retired')
    expect(getDeviceListStatus({ status: 'MAINTENANCE', lastHeartbeat: recent }, NOW).key).toBe('maintenance')
  })
})

describe('getActivationRoute — qué hace «Activar» en la lista', () => {
  it('una terminal comprada (PENDING_ACTIVATION) pide su número de serie, como siempre', () => {
    expect(getActivationRoute({ status: 'PENDING_ACTIVATION', serialNumber: null })).toBe('bindSerial')
  })

  it('🔴 una terminal creada por superadmin (INACTIVE, ya con serie) genera código: antes pedía la serie y el server la rechazaba', () => {
    expect(getActivationRoute({ status: 'INACTIVE', serialNumber: 'AVQD-N860W175377' })).toBe('generateCode')
  })

  it('cualquier otro estado sin activar también genera código', () => {
    expect(getActivationRoute({ status: 'ACTIVE', serialNumber: 'AVQD-1' })).toBe('generateCode')
    expect(getActivationRoute({ status: 'MAINTENANCE', serialNumber: 'AVQD-1' })).toBe('generateCode')
  })
})

describe('getLastSeen', () => {
  it('redondea a la unidad más grande', () => {
    expect(getLastSeen(ago(30_000), NOW)).toEqual({ unit: 'justNow', count: 0 })
    expect(getLastSeen(ago(45 * MIN), NOW)).toEqual({ unit: 'minutes', count: 45 })
    expect(getLastSeen(ago(5 * HOUR), NOW)).toEqual({ unit: 'hours', count: 5 })
    expect(getLastSeen(ago(37 * DAY), NOW)).toEqual({ unit: 'days', count: 37 })
  })

  it('fecha inválida o ausente ⇒ null', () => {
    expect(getLastSeen(null, NOW)).toBeNull()
    expect(getLastSeen('no-es-fecha', NOW)).toBeNull()
  })
})
