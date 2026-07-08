/**
 * ISR — pago provisional (Capa B fiscal) service. Gated PREMIUM (CFDI).
 *   GET /api/v1/dashboard/venues/:venueId/accounting/isr?period=YYYY-MM&regime=RESICO|GENERAL
 * Money en CENTAVOS enteros. Es una ESTIMACIÓN preliminar; el número final lo valida el contador.
 */
import api from '@/api'

export type IsrRegime = 'RESICO' | 'GENERAL'

export interface IsrProvisionalResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  regime: IsrRegime
  venueIds: string[]
  ingresosMesCents: number
  ingresosAcumCents: number
  deduccionesAcumCents: number
  /** Costo de ventas acumulado del ejercicio (inventario consumido, FIFO) — deducible en GENERAL. */
  costoVentasAcumCents: number
  /** Pérdida fiscal de ejercicios anteriores aplicada en el periodo (topada) — GENERAL. */
  perdidasFiscalesAplicadaCents: number
  utilidadFiscalCents: number
  tasaResico: number | null
  isrCausadoCents: number
  pagosProvisionalesPreviosCents: number
  /** Retención de ISR en ventas capturada del periodo (clientes morales) — reduce el ISR a pagar. */
  retencionesIsrCents: number
  isrAPagarCents: number
  excedeTopeResico: boolean
  zeroActivity: boolean
  computedAt16Percent: boolean
  rfcSpansMultipleOrgs: boolean
  /** SIEMPRE true: es una estimación preliminar, no la cifra final a declarar. */
  isEstimate?: boolean
}

export async function getIsrProvisional(venueId: string, period?: string, regime: IsrRegime = 'RESICO'): Promise<IsrProvisionalResponse> {
  const res = await api.get<IsrProvisionalResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/isr`, {
    params: { ...(period ? { period } : {}), regime },
  })
  return res.data
}

export const isrKeys = {
  all: ['isr'] as const,
  byPeriod: (venueId: string | null, period: string, regime: IsrRegime) => [...isrKeys.all, venueId, period, regime] as const,
}
