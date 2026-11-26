// src/components/conversion/planDeLaConversion.ts
//
// Planes editables (B2, Task 12, b2-r1 #9): la conversión de una demo firma lo que enseña. Con la cotización de «Tu plan» del negocio
// (`GET /plan` → `cotizacion`, una versión del editor), el asistente pinta los precios de ESA versión, apaga lo que no está a la venta
// y manda el plan elegido con el comprobante de su opción. Sin cotización (sin versión del editor), la conversión de hoy, literal.
import type { TierId } from '@/config/plan-catalog'
import type { CotizacionDeTuPlan } from '@/services/features.service'

type PlanPagado = 'PRO' | 'PREMIUM'
type Periodicidad = 'monthly' | 'annual'

/** Lo que se manda como `plan` en `convert-from-demo`. Gratis también se dice: una demo nunca pasa a Gratis en silencio. */
export type PlanPedido = { tier: 'FREE' } | { tier: PlanPagado; interval: Periodicidad; quoteToken: string }

export type PedidoDelPlan = { kind: 'HOY' } | { kind: 'PEDIDO'; plan: PlanPedido } | { kind: 'FUERA_DE_VENTA' }

const PAGADOS: PlanPagado[] = ['PRO', 'PREMIUM']

/**
 * Qué pide la conversión para el plan elegido:
 * - `HOY`: sin cotización, el cuerpo de hoy (sin `plan`);
 * - `PEDIDO`: Gratis, o un plan vendible con el comprobante de la periodicidad elegida;
 * - `FUERA_DE_VENTA`: el plan (o esa periodicidad) no vino en la cotización: no se convierte (ni a Gratis).
 */
export function pedidoDelPlan(
  cotizacion: CotizacionDeTuPlan | undefined,
  tier: 'FREE' | PlanPagado,
  interval: Periodicidad,
): PedidoDelPlan {
  if (!cotizacion) return { kind: 'HOY' }
  if (tier === 'FREE') return { kind: 'PEDIDO', plan: { tier: 'FREE' } }
  const plan = cotizacion.planes?.[tier]
  const opcion = plan?.vendible ? plan[interval] : null
  return opcion ? { kind: 'PEDIDO', plan: { tier, interval, quoteToken: opcion.quoteToken } } : { kind: 'FUERA_DE_VENTA' }
}

/**
 * Lo que el `PlanPicker` pinta con la cotización: los netos (sin IVA, centavos) de cada plan vendible, y qué planes van apagados.
 * Un plan sin sus dos periodicidades va apagado (nunca un precio del catálogo en su lugar). `null` sin cotización.
 */
export function preciosDeLaCotizacion(cotizacion: CotizacionDeTuPlan | undefined): {
  preciosSinIva: Partial<Record<TierId, { monthlyNetCents: number; annualNetCents: number }>>
  fueraDeVenta: Partial<Record<TierId, true>>
} | null {
  if (!cotizacion) return null
  const preciosSinIva: Partial<Record<TierId, { monthlyNetCents: number; annualNetCents: number }>> = {}
  const fueraDeVenta: Partial<Record<TierId, true>> = {}
  for (const tier of PAGADOS) {
    const plan = cotizacion.planes?.[tier]
    if (plan?.vendible && plan.monthly && plan.annual)
      preciosSinIva[tier] = { monthlyNetCents: plan.monthly.netCents, annualNetCents: plan.annual.netCents }
    else fueraDeVenta[tier] = true
  }
  return { preciosSinIva, fueraDeVenta }
}

/** El checkout después de convertir cita la aceptación que la conversión guardó (`planAcceptance`); sin ella, el de hoy. */
export function opcionesDelCheckout(respuesta: { planAcceptance?: { id: string } }): { acceptanceId?: string } {
  const id = respuesta?.planAcceptance?.id
  return id ? { acceptanceId: id } : {}
}
