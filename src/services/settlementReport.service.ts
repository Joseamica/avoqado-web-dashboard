import api from '@/api'

export type ReportKind = 'transactions' | 'deposits'
export type DateBasis = 'charge' | 'deposit'
export interface SettlementReportParams {
  startDate: string
  endDate: string
  dateBasis: DateBasis
  terminalIds?: string[]
  cardTypes?: string[]
  brands?: string[]
  operations?: string[]
}

const qs = (p: SettlementReportParams) => ({
  startDate: p.startDate,
  endDate: p.endDate,
  dateBasis: p.dateBasis,
  ...(p.terminalIds?.length ? { terminalIds: p.terminalIds.join(',') } : {}),
  ...(p.cardTypes?.length ? { cardTypes: p.cardTypes.join(',') } : {}),
  ...(p.brands?.length ? { brands: p.brands.join(',') } : {}),
  ...(p.operations?.length ? { operations: p.operations.join(',') } : {}),
})
const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/settlement-reports`

export async function countSettlementReport(venueId: string, p: SettlementReportParams) {
  const { data } = await api.get(`${base(venueId)}/count`, { params: qs(p) })
  return data.data as { candidateCount: number; caps: { xlsx: number; csv: number } }
}

export async function terminalOptions(venueId: string, search?: string, cursor?: string) {
  const { data } = await api.get(`${base(venueId)}/terminal-options`, { params: { search: search || undefined, cursor, limit: 50 } })
  return data.data as { items: Array<{ id: string; name: string; serialNumber: string | null }>; nextCursor: string | null }
}

export async function downloadSettlementReport(
  venueId: string,
  p: SettlementReportParams & { report: ReportKind; format: 'xlsx' | 'csv'; columns: string[] },
) {
  const res = await api.get(`${base(venueId)}/export`, {
    params: { ...qs(p), report: p.report, format: p.format, columns: p.columns.join(',') },
    responseType: 'blob',
  })
  const cd = String(res.headers['content-disposition'] ?? '')
  const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? `${p.report}-${p.startDate}-a-${p.endDate}.${p.format}`
  return { blob: res.data as Blob, filename }
}
