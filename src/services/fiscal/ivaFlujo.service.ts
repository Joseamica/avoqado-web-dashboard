/**
 * IVA en flujo de efectivo service — read-model HONESTO sobre las pólizas de cobro. Gated PREMIUM (CFDI).
 *   GET /api/v1/dashboard/venues/:venueId/accounting/vat-flow?period=YYYY-MM
 * Money en CENTAVOS enteros. El número grande es "IVA trasladado cobrado" (lado ventas); el "a pagar"
 * es un TECHO preliminar (falta el IVA acreditable de gastos, Fase 2). DIOT no disponible (lado proveedores).
 */
import api from '@/api'

export interface IvaCashflowResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  venueIds: string[]
  baseGravableCents: number
  ivaTrasladadoCobradoCents: number
  ivaAmparadoPorCfdiCents: number
  cfdiCount: number
  acreditablePagadoCents: number | null
  retencionesCents: number | null
  saldoAFavorAplicadoCents: number | null
  ivaAPagarPreliminarCents: number
  saldoAFavorDelPeriodoCents: number
  computedAt16Percent: boolean
  acreditableDisponible: boolean
  diotDisponible: boolean
  incompletoPorFaltaDeGastos: boolean
  rfcSpansMultipleOrgs: boolean
  zeroActivity: boolean
  diot: { disponible: boolean; motivo: string }
}

export async function getIvaCashflow(venueId: string, period?: string): Promise<IvaCashflowResponse> {
  const res = await api.get<IvaCashflowResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/vat-flow`, {
    params: period ? { period } : {},
  })
  return res.data
}

export const ivaCashflowKeys = {
  all: ['ivaCashflow'] as const,
  byPeriod: (venueId: string | null, period: string) => [...ivaCashflowKeys.all, venueId, period] as const,
}
