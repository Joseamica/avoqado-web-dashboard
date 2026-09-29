import { describe, expect, it } from 'vitest'
import type { PrintStation } from '@/services/printStations.service'
import {
  codigoDeRechazo,
  destinoDeComanda,
  destinoDelPlan,
  estadoDeCasilla,
  type EntradaDeCasilla,
} from '../kitchenDisplay'

describe('destinoDeComanda', () => {
  it('impresora y pantalla ⇒ AMBAS', () => expect(destinoDeComanda({ printerId: 'p1' }, true)).toBe('AMBAS'))
  it('sólo impresora ⇒ PAPEL', () => expect(destinoDeComanda({ printerId: 'p1' }, false)).toBe('PAPEL'))
  it('sólo pantalla ⇒ PANTALLA', () => expect(destinoDeComanda({ printerId: null }, true)).toBe('PANTALLA'))
  it('ni impresora ni pantalla ⇒ la impresora de cocina de la caja (hallazgo H4)', () =>
    expect(destinoDeComanda({ printerId: null }, false)).toBe('PAPEL_DE_LA_CAJA'))
})

const estacion = (over: Partial<PrintStation> = {}): PrintStation => ({
  id: 's1',
  venueId: 'v1',
  name: 'Cocina',
  printerId: 'p1',
  copies: 1,
  isDefault: true,
  isPacking: false,
  hasKitchenDisplay: true,
  active: true,
  displayOrder: 0,
  printer: { id: 'p1', name: 'Epson Cocina', active: true, lastStatus: null },
  ...over,
})

describe('destinoDelPlan', () => {
  it('estación con impresora y pantalla prendida, con Pro ⇒ AMBAS', () =>
    expect(destinoDelPlan({ stationId: 's1' }, [estacion()], true)).toBe('AMBAS'))
  it('sin Pro la pantalla no cuenta: la caja imprime ⇒ PAPEL', () =>
    expect(destinoDelPlan({ stationId: 's1' }, [estacion()], false)).toBe('PAPEL'))
  it('plan sin estación (sin ruta) ⇒ null', () => expect(destinoDelPlan({ stationId: null }, [estacion()], true)).toBeNull())
  it('estación que ya no está en la lista ⇒ null', () => expect(destinoDelPlan({ stationId: 'otra' }, [estacion()], true)).toBeNull())
})

const base: EntradaDeCasilla = {
  abiertaAClientes: true,
  esSuperadmin: false,
  puedeConfigurar: true,
  tieneAccesoPro: true,
  prendida: false,
}

describe('estadoDeCasilla', () => {
  it('antes del lanzamiento el cliente no la ve', () =>
    expect(estadoDeCasilla({ ...base, abiertaAClientes: false })).toEqual({ tipo: 'OCULTA' }))
  it('antes del lanzamiento, una que Avoqado prendió se puede APAGAR con printers:manage', () =>
    expect(estadoDeCasilla({ ...base, abiertaAClientes: false, prendida: true })).toEqual({ tipo: 'SOLO_APAGAR', motivo: 'LANZAMIENTO' }))
  it('antes del lanzamiento y sin permiso, tampoco se ve una prendida', () =>
    expect(estadoDeCasilla({ ...base, abiertaAClientes: false, prendida: true, puedeConfigurar: false })).toEqual({ tipo: 'OCULTA' }))
  it('superadmin la edita antes del lanzamiento, marcada «sólo Avoqado»', () =>
    expect(estadoDeCasilla({ ...base, abiertaAClientes: false, esSuperadmin: true })).toEqual({ tipo: 'EDITABLE', soloAvoqado: true }))
  it('superadmin después del lanzamiento: editable normal', () =>
    expect(estadoDeCasilla({ ...base, esSuperadmin: true })).toEqual({ tipo: 'EDITABLE', soloAvoqado: false }))
  it('sin printers:manage sólo se mira', () =>
    expect(estadoDeCasilla({ ...base, puedeConfigurar: false })).toEqual({ tipo: 'SOLO_LECTURA' }))
  it('sin Pro y apagada ⇒ pide mejorar el plan', () =>
    expect(estadoDeCasilla({ ...base, tieneAccesoPro: false })).toEqual({ tipo: 'REQUIERE_PRO' }))
  it('sin Pro y prendida (bajó de plan) ⇒ sólo apagar', () =>
    expect(estadoDeCasilla({ ...base, tieneAccesoPro: false, prendida: true })).toEqual({ tipo: 'SOLO_APAGAR', motivo: 'PLAN' }))
  it('con Pro y permiso ⇒ editable', () => expect(estadoDeCasilla(base)).toEqual({ tipo: 'EDITABLE', soloAvoqado: false }))
})

describe('codigoDeRechazo', () => {
  it('lee el code del cuerpo del 403 ({ message, code } del manejador global del servidor)', () =>
    expect(codigoDeRechazo({ response: { data: { message: 'x', code: 'KITCHEN_DISPLAY_REQUIRES_PRO' } } })).toBe(
      'KITCHEN_DISPLAY_REQUIRES_PRO',
    ))
  it('sin code ⇒ null', () => {
    expect(codigoDeRechazo({ response: { data: { message: 'x' } } })).toBeNull()
    expect(codigoDeRechazo(new Error('sin red'))).toBeNull()
    expect(codigoDeRechazo(undefined)).toBeNull()
  })
})
