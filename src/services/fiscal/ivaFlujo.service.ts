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
  /** IVA trasladado cobrado por tasa (llave = la tasa, "0.16"/"0.08"); un servidor anterior no lo manda. */
  ivaTrasladadoPorTasaCents?: Record<string, number>
  /** Plan 4b · base a tasa 0 % del periodo (ya incluida en baseGravableCents). */
  tasa0BaseCents?: number
  /** Plan 4b · base exenta del periodo (fuera de baseGravableCents). */
  exentoBaseCents?: number
  /** Plan 4b · base no objeto de IVA del periodo (fuera de baseGravableCents). */
  noObjetoBaseCents?: number
  /** B4b · ventas y devoluciones con IVA aproximado; 0 = todo se pudo atribuir; ausente = no se sabe (no se afirma nada). */
  movimientosConIvaAproximado?: number
  /** B4b · devoluciones del periodo en todos los locales del RFC (con `zeroActivity`: sin ventas NI devoluciones). */
  refundCount?: number
  ivaTrasladadoCobradoCents: number
  ivaAmparadoPorCfdiCents: number
  cfdiCount: number
  acreditablePagadoCents: number | null
  retencionesCents: number | null
  ivaRetenidoTercerosCents: number | null
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
