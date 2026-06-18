/**
 * Preparación fiscal (onboarding, Capa B) service — diagnóstico read-only.
 *   GET /api/v1/dashboard/venues/:venueId/accounting/readiness
 * Devuelve un checklist (ok/warn/missing + qué hacer) y las capacidades desbloqueadas.
 * Gated PREMIUM (CFDI). Sólo lectura. El label/detail de cada punto vienen del backend (es-MX).
 */
import api from '@/api'

export type ReadinessStatus = 'ok' | 'warn' | 'missing'

export interface ReadinessCheck {
  key: string
  label: string
  status: ReadinessStatus
  detail: string
}

export interface FiscalReadinessResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  legalName: string | null
  regimenFiscal: string | null
  checks: ReadinessCheck[]
  capabilities: {
    puedeFacturar: boolean
    puedeTimbrarNomina: boolean
    contabilidadElectronicaLista: boolean
  }
  resumen: { ok: number; warn: number; missing: number }
}

export async function getFiscalReadiness(venueId: string): Promise<FiscalReadinessResponse> {
  const { data } = await api.get<FiscalReadinessResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/readiness`)
  return data
}
