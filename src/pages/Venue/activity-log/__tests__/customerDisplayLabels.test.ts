import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone } from '../formatActivity'

type Bitacora = { activityLog: { actions: Record<string, string>; entities: Record<string, string>; detailKeys: Record<string, string> } }

// Las que escribe el server de F0-A (rama pantalla-cliente-f0a-v2): guardar, copiar, restablecer (también al cambiar de
// negocio) y subir una imagen.
const ACCIONES = [
  'CUSTOMER_DISPLAY_DESIGN_UPDATED',
  'CUSTOMER_DISPLAY_DESIGN_COPIED',
  'CUSTOMER_DISPLAY_DESIGN_RESET',
  'CUSTOMER_DISPLAY_ASSET_UPLOADED',
] as const
const ENTIDADES = ['CustomerDisplayDesign', 'CustomerDisplayAsset'] as const
// Las llaves de `data` que esas acciones guardan (nunca los textos del negocio: sólo qué campos cambiaron).
const CAMPOS = [
  'changedKeys',
  'sourceTerminalId',
  'editToken',
  'entitlements',
  'terminalId',
  'kind',
  'sha256',
  'bytes',
  'width',
  'height',
  'fromVenueId',
  'toVenueId',
] as const

describe('bitácora: pantalla del cliente', () => {
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    const b = bundle as unknown as Bitacora
    it(`${lng}: cada acción tiene su etiqueta`, () => {
      for (const a of ACCIONES) expect(b.activityLog.actions[a], a).toEqual(expect.any(String))
    })
    it(`${lng}: las dos entidades y los campos del detalle se leen`, () => {
      for (const e of ENTIDADES) expect(b.activityLog.entities[e], e).toEqual(expect.any(String))
      for (const c of CAMPOS) expect(b.activityLog.detailKeys[c], c).toEqual(expect.any(String))
    })
  }
  it('ninguna se pinta como destructiva (restablecer no borra nada del negocio)', () => {
    for (const a of ACCIONES) expect(actionTone(a)).not.toBe('destructive')
  })
})
