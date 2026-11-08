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
