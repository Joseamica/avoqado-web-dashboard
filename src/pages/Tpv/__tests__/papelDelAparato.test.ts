import { describe, expect, it } from 'vitest'
import { papelDelAparato } from '../papelDelAparato'

const panaderia = { id: 'a1', name: 'Panadería', sendsComanda: false, active: true }
const emisora = { canIssueAreaTickets: true, defaultWorkspace: 'AREA_OPERATIONS', areaTicketsEnabled: true, fulfillmentArea: panaderia }

describe('papelDelAparato (Aparatos claros, Paso 1)', () => {
  it('emite de verdad (como ANDROID: vales prendidos, «Emitir», área activa y pantalla de vales): no cobra', () => {
    expect(papelDelAparato({ ...emisora, canCheckoutAreaTickets: false })).toEqual({
      tipo: 'emite',
      area: panaderia,
      noCobra: true,
      emitirSinEfecto: null,
    })
  })

  it('con «Emitir» y «Cobrar» a la vez sólo emite (D5): tampoco cobra', () => {
    expect(papelDelAparato({ ...emisora, canCheckoutAreaTickets: true })).toMatchObject({ tipo: 'emite', noCobra: true })
  })

  it('la caja (cobra vales) y una PC normal: «Cobra»', () => {
    expect(papelDelAparato({ canCheckoutAreaTickets: true, areaTicketsEnabled: true, fulfillmentArea: null })).toEqual({
      tipo: 'cobra',
      area: null,
      noCobra: false,
      emitirSinEfecto: null,
    })
    expect(papelDelAparato({ canIssueAreaTickets: false, areaTicketsEnabled: true })).toMatchObject({ tipo: 'cobra', noCobra: false })
  })

  it.each([
    ['sin área', { fulfillmentArea: null }, 'sinArea'],
    ['con el área apagada', { fulfillmentArea: { ...panaderia, active: false } }, 'areaApagada'],
    ['sin la pantalla de vales', { defaultWorkspace: 'STANDARD_POS' }, 'sinPantallaDeVales'],
  ] as const)('«Emitir» prendido %s: en ANDROID cobra como POS normal, y se dice por qué (Codex r1 #2)', (_c, cambio, razon) => {
    expect(papelDelAparato({ ...emisora, ...cambio })).toEqual({ tipo: 'cobra', area: null, noCobra: false, emitirSinEfecto: razon })
  })

  it('con los vales apagados en el negocio o un SERVIDOR viejo: no hay papel (la ficha se ve como hoy)', () => {
    expect(papelDelAparato({ ...emisora, areaTicketsEnabled: false })).toBeNull()
    expect(papelDelAparato({ ...emisora, areaTicketsEnabled: undefined })).toBeNull()
  })
})

import { esNombreDeFabrica, necesitaConfigurar, papelCorto } from '../papelDelAparato'

describe('papelCorto (Paso 2)', () => {
  const pos = { type: 'POS_ANDROID' }
  const inactiva = { ...panaderia, active: false }
  it('terminal de cobro gana con cualquier vale', () => {
    expect(papelCorto({ type: 'TPV_ANDROID', canIssueAreaTickets: true }, true)).toEqual({ clave: 'terminalDeCobro', aviso: null })
    expect(papelCorto({ type: 'TPV_IOS' }, undefined).clave).toBe('terminalDeCobro')
  })
  it('sin vales prendidos: punto de venta', () => {
    expect(papelCorto({ ...pos, ...emisora }, false)).toEqual({ clave: 'puntoDeVenta', aviso: null })
    expect(papelCorto({ ...pos, ...emisora }, undefined).clave).toBe('puntoDeVenta')
  })
  it('emite, también con cobrar (D5)', () => {
    expect(papelCorto({ ...pos, ...emisora, canCheckoutAreaTickets: true }, true)).toEqual({ clave: 'emite', area: 'Panadería', aviso: null })
  })
  it('emitir sin efecto', () => {
    expect(papelCorto({ ...pos, ...emisora, fulfillmentArea: inactiva }, true)).toEqual({ clave: 'puntoDeVenta', aviso: 'areaApagada' })
    expect(papelCorto({ ...pos, ...emisora, fulfillmentArea: null }, true)).toEqual({ clave: 'puntoDeVenta', aviso: 'sinArea' })
    expect(papelCorto({ ...pos, ...emisora, defaultWorkspace: 'POS' }, true)).toEqual({ clave: 'puntoDeVenta', aviso: 'sinPantallaDeVales' })
  })
  it('cobra vales y entrega vales', () => {
    expect(papelCorto({ ...pos, canCheckoutAreaTickets: true }, true)).toEqual({ clave: 'cobraVales', aviso: null })
    expect(papelCorto({ ...pos, canDeliverAreaTickets: true, fulfillmentArea: panaderia }, true)).toEqual({ clave: 'entregaVales', area: 'Panadería', aviso: null })
    expect(papelCorto({ ...pos, canDeliverAreaTickets: true, fulfillmentArea: inactiva }, true)).toEqual({ clave: 'sinElegir', aviso: 'areaApagada' })
    expect(papelCorto({ ...pos, canDeliverAreaTickets: true }, true)).toEqual({ clave: 'sinElegir', aviso: 'sinArea' })
  })
  it('nada: sin elegir', () => {
    expect(papelCorto(pos, true)).toEqual({ clave: 'sinElegir', aviso: null })
  })
})

describe('esNombreDeFabrica', () => {
  const b = { selfRegistered: true, model: 'SM-T295' }
  it('detecta el nombre del servidor', () => {
    expect(esNombreDeFabrica({ ...b, name: 'SM-T295' })).toBe(true)
    expect(esNombreDeFabrica({ ...b, name: 'SM-T295 (2)' })).toBe(true)
  })
  it('rechaza nombres puestos a mano y casos sin datos', () => {
    expect(esNombreDeFabrica({ ...b, name: 'SM-T295 (Caja norte)' })).toBe(false)
    expect(esNombreDeFabrica({ ...b, name: 'Caja' })).toBe(false)
    expect(esNombreDeFabrica({ name: 'SM-T295', model: null, selfRegistered: true })).toBe(false)
    expect(esNombreDeFabrica({ name: 'SM-T295', model: 'SM-T295' })).toBe(false)
  })
  it('un modelo con caracteres de regex no rompe', () => {
    expect(esNombreDeFabrica({ name: 'A910S+ (3)', model: 'A910S+', selfRegistered: true })).toBe(true)
    expect(esNombreDeFabrica({ name: 'A910SS', model: 'A910S+', selfRegistered: true })).toBe(false)
  })
})

describe('necesitaConfigurar', () => {
  const ok = { type: 'POS_IOS', selfRegistered: true, areaRoleChosenAt: null }
  const vales = { enabled: true, activeAreaCount: 1 }
  it('true con todas las condiciones', () => {
    expect(necesitaConfigurar(ok, vales)).toBe(true)
    expect(necesitaConfigurar({ ...ok, type: 'POS_DESKTOP' }, vales)).toBe(true)
  })
  it('false si falta cualquiera', () => {
    expect(necesitaConfigurar(ok, { enabled: false, activeAreaCount: 1 })).toBe(false)
    expect(necesitaConfigurar(ok, { enabled: true, activeAreaCount: 0 })).toBe(false)
    expect(necesitaConfigurar({ ...ok, type: 'TPV_ANDROID' }, vales)).toBe(false)
    expect(necesitaConfigurar({ ...ok, selfRegistered: false }, vales)).toBe(false)
    expect(necesitaConfigurar({ ...ok, areaRoleChosenAt: '2026-11-09T00:00:00Z' }, vales)).toBe(false)
    expect(necesitaConfigurar(ok, undefined)).toBe(false)
  })
})

describe('papelCorto · tipos que no son POS ni TPV (Codex final #4)', () => {
  it.each(['PRINTER_RECEIPT', 'PRINTER_KITCHEN', 'KDS', 'ALGO_NUEVO', ''])('%j: no aplica, sin aviso, con o sin vales', type => {
    expect(papelCorto({ type, canIssueAreaTickets: true, canDeliverAreaTickets: true }, true)).toEqual({ clave: 'noAplica', aviso: null })
    expect(papelCorto({ type }, false)).toEqual({ clave: 'noAplica', aviso: null })
  })
  it('la regla de terminal de cobro sigue ganando', () => {
    expect(papelCorto({ type: 'TPV_IOS' }, true)).toEqual({ clave: 'terminalDeCobro', aviso: null })
  })
  it('necesitaConfigurar es false para impresoras y pantallas de cocina', () => {
    const vales = { enabled: true, activeAreaCount: 2 }
    for (const type of ['PRINTER_RECEIPT', 'PRINTER_KITCHEN', 'KDS']) expect(necesitaConfigurar({ type, selfRegistered: true, areaRoleChosenAt: null }, vales)).toBe(false)
  })
})
