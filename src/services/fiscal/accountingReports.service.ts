/**
 * Reportes contables service — read-models sobre pólizas. Gated PREMIUM (CFDI).
 *   GET /api/v1/dashboard/venues/:venueId/accounting/reports?period=YYYY-MM
 * Money en CENTAVOS enteros.
 */
import api from '@/api'

export interface ReportLine {
  code: string
  name: string
  amountCents: number
}

export interface IncomeStatement {
  ingresos: { lines: ReportLine[]; totalCents: number }
  costos: { lines: ReportLine[]; totalCents: number }
  utilidadBrutaCents: number
  gastos: { lines: ReportLine[]; totalCents: number }
  resultadoCents: number
}

export interface BalanceSheet {
  activo: { lines: ReportLine[]; totalCents: number }
  pasivo: { lines: ReportLine[]; totalCents: number }
  capital: { lines: ReportLine[]; totalCents: number }
  resultadoEjercicioCents: number
  balanced: boolean
}

export interface AccountingReportsResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  fiscalYearStart: string
  incomeStatement: IncomeStatement
  balanceSheet: BalanceSheet
}

export async function getAccountingReports(venueId: string, period?: string): Promise<AccountingReportsResponse> {
  const res = await api.get<AccountingReportsResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/reports`, {
    params: period ? { period } : {},
  })
  return res.data
}

export const accountingReportsKeys = {
  all: ['accountingReports'] as const,
  byPeriod: (venueId: string | null, period: string) => [...accountingReportsKeys.all, venueId, period] as const,
}
