/**
 * El dinero que la pantalla de oferta enseña y manda (§4.5).
 *
 * 🔴 La regla del archivo: el dashboard NO calcula dinero. Formatea centavos que le dio el
 * servidor y ELIGE cuál de los números del servidor corresponde a la combinación que el usuario
 * tocó. Cualquier aritmética aquí sería una segunda fuente de verdad del precio.
 */
import { describe, expect, it } from 'vitest'

import { formatMXN } from '../offer/formatMXN'
import { expectedStandardFirstChargeCents } from '../offer/standardQuote'
import type { PlanQuote } from '../launchOffer.types'

const quote: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: { monthlyCents: 115884, annualCents: 1158840, intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true } },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
  },
}

describe('formatMXN', () => {
  it('pinta centavos como pesos mexicanos', () => {
    expect(formatMXN(2200)).toBe('$22.00')
    expect(formatMXN(115884)).toBe('$1,158.84')
    expect(formatMXN(303)).toBe('$3.03')
    expect(formatMXN(0)).toBe('$0.00')
  })

  it('un valor no numérico no pinta «NaN» en la cara del cliente', () => {
    expect(formatMXN(Number.NaN)).toBe('—')
    expect(formatMXN(undefined as unknown as number)).toBe('—')
  })

  it('nunca redondea a pesos: los centavos del IVA son parte del precio', () => {
    expect(formatMXN(1897)).toBe('$18.97')
  })
})

describe('expectedStandardFirstChargeCents', () => {
  it('con prueba de 30 días hoy no se cobra nada', () => {
    expect(expectedStandardFirstChargeCents(quote, 'PRO', 'monthly', false)).toBe(0)
    expect(expectedStandardFirstChargeCents(quote, 'PREMIUM', 'annual', false)).toBe(0)
  })

  it('PRO mensual pagando hoy toma el precio PROMOCIONAL del servidor, no el de lista', () => {
    expect(expectedStandardFirstChargeCents(quote, 'PRO', 'monthly', true)).toBe(69484)
  })

  it('PRO anual pagando hoy cobra el anual de lista (la promo es solo mensual)', () => {
    expect(expectedStandardFirstChargeCents(quote, 'PRO', 'annual', true)).toBe(1158840)
  })

  it('PREMIUM no tiene promo: cobra su precio de lista', () => {
    expect(expectedStandardFirstChargeCents(quote, 'PREMIUM', 'monthly', true)).toBe(197084)
    expect(expectedStandardFirstChargeCents(quote, 'PREMIUM', 'annual', true)).toBe(1970840)
  })

  it('una promo que EXIGE pago inmediato no se aplica a una prueba gratis', () => {
    expect(expectedStandardFirstChargeCents(quote, 'PRO', 'monthly', false)).toBe(0)
  })

  it('una promo que NO exige pago inmediato tampoco cambia el cobro de una prueba (hoy es 0)', () => {
    const sinExigencia: PlanQuote = {
      ...quote,
      tiers: { ...quote.tiers, PRO: { ...quote.tiers.PRO, intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: false } } },
    }
    expect(expectedStandardFirstChargeCents(sinExigencia, 'PRO', 'monthly', false)).toBe(0)
  })

  it('sin cotización del servidor devuelve null: NO se inventa un monto para cobrar', () => {
    expect(expectedStandardFirstChargeCents(null, 'PRO', 'monthly', true)).toBeNull()
    expect(expectedStandardFirstChargeCents(undefined, 'PRO', 'monthly', false)).toBeNull()
  })
})
