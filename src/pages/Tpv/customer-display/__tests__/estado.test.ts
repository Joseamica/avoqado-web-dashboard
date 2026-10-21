import { describe, expect, it } from 'vitest'
import type { CustomerDisplayFicha, CustomerDisplayView } from '@/services/customerDisplay.service'
import { DISENO_DE_FABRICA } from '../model'
import {
  CLAVE_DEL_HISTORIAL,
  esperandoALaPantalla,
  estadoDeLaPantalla,
  haceCuanto,
  intervaloDeRefresco,
  leerAcuse,
  REFRESCO_MAXIMO_MS,
  REFRESCO_MS,
} from '../estado'

const FICHA: CustomerDisplayFicha = {
  schemaVersion: 1,
  fingerprint: 'fp-vigente',
  theme: 'LIGHT',
  accent: { custom: false },
  logo: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  promotionCards: { enabled: false },
  poweredBy: true,
}
const acuse = (extra: Record<string, unknown> = {}) => ({
  fingerprint: 'fp-vigente',
  seq: 3,
  receivedAt: '2026-10-14T20:02:00.000Z',
  storedAt: '2026-10-14T20:01:58.000Z',
  shownAt: '2026-10-14T20:01:59.000Z',
  surface: 'presentation',
  imagesReady: 0,
  imagesPending: 0,
  imagesFailed: 0,
  unsupportedSchema: false,
  ...extra,
})
function vista(
  device: Partial<CustomerDisplayView['device']> = {},
  design = DISENO_DE_FABRICA,
): Pick<CustomerDisplayView, 'design' | 'ficha' | 'device'> {
  return {
    design,
    ficha: FICHA,
    device: {
      presence: 'SUPPORTED',
      stale: false,
      capabilitiesObservedAt: '2026-10-14T19:00:00.000Z',
      lastHeartbeat: '2026-10-14T20:05:00.000Z',
      designVersion: 1,
      ack: null,
      installationWarning: false,
      ...device,
    },
  }
}

describe('leerAcuse (Review Focus 6)', () => {
  it('🔴 un acuse ilegible no se inventa: null', () => {
    for (const malo of [null, undefined, 'texto', 42, [], {}, { fingerprint: 7, receivedAt: 'x' }, { fingerprint: 'fp' }])
      expect(leerAcuse(malo)).toBeNull()
  })
  it('normaliza lo opcional: superficie desconocida ⇒ null, números raros ⇒ 0', () => {
    expect(leerAcuse(acuse({ surface: 'otra', imagesPending: -2, imagesFailed: 'tres', shownAt: 5 }))).toMatchObject({
      surface: null,
      imagesPending: 0,
      imagesFailed: 0,
      shownAt: null,
    })
  })
  it('🔴 fechas que no son ISO válidas no son evidencia (B2 r2): sin `receivedAt` legible no hay acuse; storedAt/shownAt ilegibles ⇒ null', () => {
    for (const malo of ['', '   ', 'basura', '2026-13-45T99:00:00Z']) expect(leerAcuse(acuse({ receivedAt: malo })), malo).toBeNull()
    expect(leerAcuse(acuse({ storedAt: 'basura', shownAt: '' }))).toMatchObject({ storedAt: null, shownAt: null })
    const h = (extra: Record<string, unknown>) => estadoDeLaPantalla(vista({ ack: acuse(extra) })).historial
    expect(h({ storedAt: 'ayer', shownAt: null })).toEqual({ tipo: 'recibido' })
    expect(h({ shownAt: 'hace rato' })).toEqual({ tipo: 'guardado', fecha: '2026-10-14T20:02:00.000Z' })
    expect(h({ receivedAt: 'nunca' })).toEqual({ tipo: 'sinAcuse' })
  })
})

describe('estadoDeLaPantalla — histórico (sólo con evidencia)', () => {
  const h = (device: Partial<CustomerDisplayView['device']>) => estadoDeLaPantalla(vista(device)).historial
  it('app sin diseños, sin acuse, ilegible y otra huella', () => {
    expect(h({ designVersion: null, ack: acuse() })).toEqual({ tipo: 'appSinDisenos' })
    expect(h({ ack: null })).toEqual({ tipo: 'sinAcuse' })
    expect(h({ ack: { basura: true } })).toEqual({ tipo: 'sinAcuse' })
    expect(h({ ack: acuse({ fingerprint: 'fp-viejo' }) })).toEqual({ tipo: 'pendiente' })
  })
  it('🔴 la huella vigente SIN storedAt no es «guardado»: es «recibido» (Codex #11)', () => {
    expect(h({ ack: acuse({ storedAt: null, shownAt: null }) })).toEqual({ tipo: 'recibido' })
    expect(h({ ack: acuse({ storedAt: null, shownAt: null, surface: 'kiosk' }) })).toEqual({ tipo: 'recibido' })
  })
  it('🔴 un esquema que la app no entiende no es «guardado» ni «mostrado», aunque la huella coincida', () => {
    expect(h({ ack: acuse({ unsupportedSchema: true }) })).toEqual({ tipo: 'noSoportado' })
    expect(h({ ack: acuse({ unsupportedSchema: true, storedAt: null }) })).toEqual({ tipo: 'noSoportado' })
  })
  it('mostrado / guardado sin mostrar / kiosco, con la hora del SERVIDOR (receivedAt)', () => {
    expect(h({ ack: acuse() })).toEqual({ tipo: 'mostrado', fecha: '2026-10-14T20:02:00.000Z' })
    expect(h({ ack: acuse({ shownAt: null }) })).toEqual({ tipo: 'guardado', fecha: '2026-10-14T20:02:00.000Z' })
    expect(h({ ack: acuse({ surface: 'kiosk', shownAt: null }) })).toEqual({ tipo: 'kiosco', fecha: '2026-10-14T20:02:00.000Z' })
  })
  it('agregados: imágenes pendientes y fallidas; promos con app v1; aviso de instalaciones', () => {
    expect(estadoDeLaPantalla(vista({ ack: acuse({ imagesPending: 2, imagesFailed: 1 }) }))).toMatchObject({
      imagenesDescargandose: 2,
      imagenesFallidas: 1,
    })
    expect(estadoDeLaPantalla(vista({ designVersion: 1 }, { ...DISENO_DE_FABRICA, showPromotions: true })).promosPidenActualizar).toBe(true)
    expect(estadoDeLaPantalla(vista({ designVersion: 2 }, { ...DISENO_DE_FABRICA, showPromotions: true })).promosPidenActualizar).toBe(
      false,
    )
    expect(estadoDeLaPantalla(vista({ installationWarning: true })).avisoDeInstalaciones).toBe(true)
  })
  it('cada estado histórico tiene su llave de texto', () => {
    expect(Object.keys(CLAVE_DEL_HISTORIAL).sort()).toEqual([
      'appSinDisenos',
      'guardado',
      'kiosco',
      'mostrado',
      'noSoportado',
      'pendiente',
      'recibido',
      'sinAcuse',
    ])
  })
})

describe('estadoDeLaPantalla — presente', () => {
  it('detectada con su fecha; ausente; desconocida si es vieja o no se sabe', () => {
    expect(estadoDeLaPantalla(vista()).presencia).toEqual({ tipo: 'detectada', fecha: '2026-10-14T19:00:00.000Z' })
    expect(estadoDeLaPantalla(vista({ presence: 'UNSUPPORTED' })).presencia).toEqual({ tipo: 'ausente' })
    expect(estadoDeLaPantalla(vista({ presence: 'UNKNOWN' })).presencia).toEqual({ tipo: 'desconocida' })
    expect(estadoDeLaPantalla(vista({ stale: true })).presencia).toEqual({ tipo: 'desconocida' })
    expect(estadoDeLaPantalla(vista({ lastHeartbeat: null })).latido).toBeNull()
  })
  it('relativo en el idioma de la app', () => {
    expect(haceCuanto('2026-10-14T20:00:00.000Z', 'es-MX', new Date('2026-10-14T20:01:00.000Z'))).toBe('hace 1 minuto')
    expect(haceCuanto('2026-10-14T20:00:00.000Z', 'en-US', new Date('2026-10-14T20:01:00.000Z'))).toBe('1 minute ago')
    expect(haceCuanto('no-es-fecha', 'es-MX')).toBe('')
  })
})

describe('refresco acotado (Codex #12)', () => {
  it('🔴 se sigue preguntando hasta el estado FINAL, no hasta la primera huella', () => {
    expect(esperandoALaPantalla(undefined)).toBe(false)
    expect(esperandoALaPantalla(vista({ designVersion: null }))).toBe(true) // la app se puede actualizar en cualquier momento
    expect(esperandoALaPantalla(vista({ ack: null }))).toBe(true)
    expect(esperandoALaPantalla(vista({ ack: acuse({ shownAt: null }) }))).toBe(true) // guardado → falta mostrado
    expect(esperandoALaPantalla(vista({ ack: acuse({ imagesPending: 2 }) }))).toBe(true) // mostrado, imágenes pendientes
    expect(esperandoALaPantalla(vista({ ack: acuse({ unsupportedSchema: true }) }))).toBe(true)
    expect(esperandoALaPantalla(vista({ ack: acuse() }))).toBe(false)
  })
  it('cada 30 s, y nunca más allá de 30 min desde que se montó la tarjeta', () => {
    const v = vista({ ack: null })
    expect(intervaloDeRefresco(v, 0, 1_000)).toBe(REFRESCO_MS)
    expect(intervaloDeRefresco(v, 0, REFRESCO_MAXIMO_MS + 1)).toBe(false)
    expect(intervaloDeRefresco(vista({ ack: acuse() }), 0, 1_000)).toBe(false)
  })
})
