/**
 * Candado de periodo contable service — gated PREMIUM (bundle con CFDI).
 *
 *   GET  /api/v1/dashboard/venues/:venueId/accounting/period-locks
 *   POST …/accounting/period-locks/close   body: { period: 'YYYY-MM', reason? }
 *   POST …/accounting/period-locks/reopen  body: { period: 'YYYY-MM', reason? }
 *
 * Un periodo CERRADO no admite pólizas nuevas ni correcciones dentro de ese mes.
 */
import api from '@/api'

export type PeriodLockStatus = 'CLOSED' | 'OPEN'

export interface PeriodLockRow {
  period: string
  status: PeriodLockStatus
  closedAt: string
  reopenedAt: string | null
  reason: string | null
}

export interface PeriodLocksResponse {
  needsFiscalSetup: boolean
  rfc: string | null
  locks: PeriodLockRow[]
}

export interface PeriodLockResult {
  needsFiscalSetup: boolean
  period: string
  status: PeriodLockStatus | null
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/period-locks`

export async function getPeriodLocks(venueId: string): Promise<PeriodLocksResponse> {
  const res = await api.get<PeriodLocksResponse>(base(venueId))
  return res.data
}

export async function closePeriod(venueId: string, period: string, reason?: string): Promise<PeriodLockResult> {
  const res = await api.post<PeriodLockResult>(`${base(venueId)}/close`, { period, reason: reason || undefined })
  return res.data
}

export async function reopenPeriod(venueId: string, period: string, reason?: string): Promise<PeriodLockResult> {
  const res = await api.post<PeriodLockResult>(`${base(venueId)}/reopen`, { period, reason: reason || undefined })
  return res.data
}

export const periodLockKeys = {
  all: ['period-locks'] as const,
  list: (venueId: string | null) => [...periodLockKeys.all, venueId] as const,
}
