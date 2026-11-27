// src/components/conversion/__tests__/planDeLaConversion.test.ts
// Planes editables (B2, Task 12, b2-r1 #9): la conversión de una demo firma lo que enseña. Con la cotización de «Tu plan» del negocio,
// el plan que se manda lleva el comprobante de esa opción, los precios son los de la versión y un plan fuera de venta no se convierte.
import { describe, expect, it } from 'vitest'
import type { CotizacionDeTuPlan, OpcionCotizada } from '@/services/features.service'
import { opcionesDelCheckout, pedidoDelPlan, preciosDeLaCotizacion } from '../planDeLaConversion'

const opcion = (precioCents: number, netCents: number): OpcionCotizada => ({
  quoteToken: `tok_${precioCents}`,
  precioCents,
  netCents,
  firstChargeCents: precioCents,
  trialEndsAt: null,
})
const V2: CotizacionDeTuPlan = {
  versionNumber: 2,
  planes: {
    PRO: { displayName: 'Pro', vendible: true, monthly: opcion(92684, 79900), annual: opcion(926840, 799000) },
    PREMIUM: { displayName: 'Premium', vendible: true, monthly: opcion(197084, 169900), annual: opcion(1970840, 1699000) },
  },
}
const PRO_FUERA: CotizacionDeTuPlan = {
  ...V2,
  planes: { ...V2.planes, PRO: { displayName: 'Pro', vendible: false, monthly: null, annual: null } },
}

describe('planDeLaConversion', () => {
  it('pedidoDelPlan: sin cotizacion → HOY; Gratis → PEDIDO { tier: "FREE" }; Pro mensual vendible → PEDIDO con su quoteToken; Pro no vendible → FUERA_DE_VENTA', () => {
    expect(pedidoDelPlan(undefined, 'PRO', 'monthly')).toEqual({ kind: 'HOY' })
    expect(pedidoDelPlan(undefined, 'FREE', 'monthly')).toEqual({ kind: 'HOY' })
    expect(pedidoDelPlan(V2, 'FREE', 'annual')).toEqual({ kind: 'PEDIDO', plan: { tier: 'FREE' } })
    expect(pedidoDelPlan(V2, 'PRO', 'monthly')).toEqual({
      kind: 'PEDIDO',
      plan: { tier: 'PRO', interval: 'monthly', quoteToken: 'tok_92684' },
    })
    expect(pedidoDelPlan(V2, 'PREMIUM', 'annual')).toEqual({
      kind: 'PEDIDO',
      plan: { tier: 'PREMIUM', interval: 'annual', quoteToken: 'tok_1970840' },
    })
    expect(pedidoDelPlan(PRO_FUERA, 'PRO', 'monthly')).toEqual({ kind: 'FUERA_DE_VENTA' })
    expect(pedidoDelPlan(PRO_FUERA, 'PRO', 'annual')).toEqual({ kind: 'FUERA_DE_VENTA' })
    // Una periodicidad que no vino tampoco se convierte (nunca un plan sin su comprobante).
    const sinAnual: CotizacionDeTuPlan = { ...V2, planes: { ...V2.planes, PRO: { ...V2.planes.PRO, annual: null } } }
    expect(pedidoDelPlan(sinAnual, 'PRO', 'annual')).toEqual({ kind: 'FUERA_DE_VENTA' })
  })

  it('preciosDeLaCotizacion: el nombre, los netos y los brutos de la v2 (Pro mensual 79900) y Pro marcado fuera de venta cuando vendible es false', () => {
    expect(preciosDeLaCotizacion(undefined)).toBeNull()
    expect(preciosDeLaCotizacion(V2)).toEqual({
      preciosSinIva: {
        PRO: {
          monthlyNetCents: 79900,
          annualNetCents: 799000,
          displayName: 'Pro',
          monthlyGrossCents: 92684,
          annualGrossCents: 926840,
        },
        PREMIUM: {
          monthlyNetCents: 169900,
          annualNetCents: 1699000,
          displayName: 'Premium',
          monthlyGrossCents: 197084,
          annualGrossCents: 1970840,
        },
      },
      fueraDeVenta: {},
    })
    expect(preciosDeLaCotizacion(PRO_FUERA)).toEqual({
      preciosSinIva: {
        PREMIUM: {
          monthlyNetCents: 169900,
          annualNetCents: 1699000,
          displayName: 'Premium',
          monthlyGrossCents: 197084,
          annualGrossCents: 1970840,
        },
      },
      fueraDeVenta: { PRO: true },
    })
  })

  it('opcionesDelCheckout toma el id de planAcceptance; sin él, {}', () => {
    expect(opcionesDelCheckout({ planAcceptance: { id: 'cacc1' } })).toEqual({ acceptanceId: 'cacc1' })
    expect(opcionesDelCheckout({})).toEqual({})
    expect(opcionesDelCheckout(undefined as never)).toEqual({})
  })
})
