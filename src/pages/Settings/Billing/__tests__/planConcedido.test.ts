import { describe, it, expect } from 'vitest'
import { contratacionLigada, planDePagoConcedido } from '../planConcedido'

describe('planDePagoConcedido', () => {
  it('los estados CON acceso cuentan como concedido', () => {
    // 'past_due' y 'canceling' conservan el acceso: el resolver sólo lo niega con
    // `!active || suspendedAt`, y en esos dos la fila sigue activa y sin suspender.
    for (const estado of ['active', 'trial', 'canceling', 'past_due']) {
      expect(planDePagoConcedido(estado)).toBe(true)
    }
  })

  it('🔴 los estados SIN acceso no lo son: es justo el caso en el que la pantalla mentía', () => {
    for (const estado of ['canceled', 'suspended', 'none']) {
      expect(planDePagoConcedido(estado)).toBe(false)
    }
  })

  it('🔴 sin dato tampoco se afirma nada', () => {
    expect(planDePagoConcedido(null)).toBe(false)
    expect(planDePagoConcedido(undefined)).toBe(false)
    expect(planDePagoConcedido('')).toBe(false)
  })
})

// D3: al volver de Stripe tras quedarse con el plan de una prueba regalada, el acceso YA existía (la cortesía): decir «quedó»
// exige la suscripción ligada, no sólo el acceso (Codex diseño r1 #5).
describe('contratacionLigada', () => {
  it('con acceso Y suscripción ligada → quedó', () => {
    expect(contratacionLigada({ state: 'trial', stripeSubscriptionId: 'sub_1' })).toBe(true)
  })
  it('🔴 la cortesía de antes (acceso sin suscripción) no cuenta como contratada', () => {
    expect(contratacionLigada({ state: 'trial', stripeSubscriptionId: null })).toBe(false)
  })
  it('sin acceso o sin dato → no', () => {
    expect(contratacionLigada({ state: 'canceled', stripeSubscriptionId: 'sub_1' })).toBe(false)
    expect(contratacionLigada(undefined)).toBe(false)
  })
})
