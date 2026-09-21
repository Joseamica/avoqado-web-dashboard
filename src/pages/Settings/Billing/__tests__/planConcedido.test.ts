import { describe, it, expect } from 'vitest'
import { planDePagoConcedido } from '../planConcedido'

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
