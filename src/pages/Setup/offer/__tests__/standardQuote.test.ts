/**
 * `opcionDelAlta` ELIGE la opción cotizada que el SERVIDOR firmó (planes editables, B2): nunca calcula un monto.
 * `expectedStandardFirstChargeCents` sigue igual para el alta sin versión del editor.
 */
import { describe, expect, it } from 'vitest'

import type { OfertaDelAlta, OpcionCotizada, PlanQuote } from '../../launchOffer.types'
import { expectedStandardFirstChargeCents, opcionDelAlta } from '../standardQuote'

const opcion = (quoteToken: string, precioCents: number, trialEndsAt: string | null): OpcionCotizada => ({
  quoteToken,
  precioCents,
  netCents: Math.round(precioCents / 1.16),
  firstChargeCents: trialEndsAt ? 0 : precioCents,
  trialEndsAt,
})

const OFERTA: OfertaDelAlta = {
  versionNumber: 2,
  free: { displayName: 'Gratis' },
  planes: {
    PRO: {
      displayName: 'Pro',
      onSale: true,
      requiresCard: false,
      trialDays: 14,
      monthly: opcion('tok-pro-mes', 92684, '2026-12-15T18:00:00.000Z'),
      annual: opcion('tok-pro-anual', 926840, '2026-12-15T18:00:00.000Z'),
    },
    PREMIUM: { displayName: 'Premium', onSale: false, requiresCard: true, trialDays: 0, monthly: null, annual: null },
  },
}

const HOY: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: {
      monthlyCents: 115884,
      annualCents: 1158840,
      intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true },
    },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
  },
}

describe('standardQuote', () => {
  it('opcionDelAlta elige la opción del plan y la periodicidad; sin oferta o con el plan fuera de venta → null', () => {
    const conOferta: PlanQuote = { ...HOY, oferta: OFERTA }
    expect(opcionDelAlta(conOferta, 'PRO', 'monthly')).toBe(OFERTA.planes.PRO.monthly)
    expect(opcionDelAlta(conOferta, 'PRO', 'annual')).toBe(OFERTA.planes.PRO.annual)
    // Fuera de venta: no hay opción aunque el plan exista.
    expect(opcionDelAlta(conOferta, 'PREMIUM', 'monthly')).toBeNull()
    // Un plan en venta cuya ranura no vino (no debería pasar): null, nunca un monto inventado.
    const sinRanura: PlanQuote = {
      ...HOY,
      oferta: { ...OFERTA, planes: { ...OFERTA.planes, PRO: { ...OFERTA.planes.PRO, annual: null } } },
    }
    expect(opcionDelAlta(sinRanura, 'PRO', 'annual')).toBeNull()
    // Sin versión del editor (`planQuote` de hoy) o sin cotización: null.
    expect(opcionDelAlta(HOY, 'PRO', 'monthly')).toBeNull()
    expect(opcionDelAlta(null, 'PRO', 'monthly')).toBeNull()
    expect(opcionDelAlta(undefined, 'PREMIUM', 'monthly')).toBeNull()
  })

  it('expectedStandardFirstChargeCents sin oferta devuelve lo de hoy', () => {
    expect(expectedStandardFirstChargeCents(HOY, 'PRO', 'monthly', false)).toBe(0)
    expect(expectedStandardFirstChargeCents(HOY, 'PRO', 'monthly', true)).toBe(69484)
    expect(expectedStandardFirstChargeCents(HOY, 'PRO', 'annual', true)).toBe(1158840)
    expect(expectedStandardFirstChargeCents(HOY, 'PREMIUM', 'monthly', true)).toBe(197084)
    expect(expectedStandardFirstChargeCents(null, 'PRO', 'monthly', false)).toBeNull()
  })
})
