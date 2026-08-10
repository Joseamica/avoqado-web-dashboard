import {
  getSalesExportRows,
  type SalesExportRow,
  type SalesExportRowsParams,
  type SalesExportRowsResponse,
} from '@/services/storesAnalysis.service'
import { formatCurrencyForExport, formatDateForExport } from '@/utils/export'

const EXPORT_PAGE_SIZE = 500

export const SUPERVISOR_TABS = ['operativo', 'checkin', 'ventas', 'ubicacion'] as const
export type SupervisorTab = (typeof SUPERVISOR_TABS)[number]

export function resolveSupervisorTab(hash: string): SupervisorTab {
  const value = hash.replace(/^#/, '')
  return SUPERVISOR_TABS.includes(value as SupervisorTab) ? (value as SupervisorTab) : 'operativo'
}

type FetchSalesExportPage = (venueId: string, params: SalesExportRowsParams) => Promise<SalesExportRowsResponse>

interface FetchAllSalesExportRowsInput {
  venueId: string
  startDate: string
  endDate: string
  filterVenueId?: string
  fetchPage?: FetchSalesExportPage
  onProgress?: (progress: { fetched: number; total?: number }) => void
}

export async function fetchAllSalesExportRows({
  venueId,
  startDate,
  endDate,
  filterVenueId,
  fetchPage = getSalesExportRows,
  onProgress,
}: FetchAllSalesExportRowsInput): Promise<SalesExportRow[]> {
  // Capture one immutable filter snapshot so changing the UI mid-export cannot
  // splice together pages from different stores or ranges.
  const snapshot = Object.freeze({ startDate, endDate, filterVenueId })
  const rows: SalesExportRow[] = []
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  let total: number | undefined

  do {
    const page = await fetchPage(venueId, {
      ...snapshot,
      cursor,
      limit: EXPORT_PAGE_SIZE,
    })
    if (total === undefined && page.total !== undefined) total = page.total
    rows.push(...page.rows)
    onProgress?.({ fetched: rows.length, total })

    if (!page.nextCursor) break
    if (seenCursors.has(page.nextCursor)) {
      throw new Error('El servidor devolvió un cursor de exportación repetido')
    }
    seenCursors.add(page.nextCursor)
    cursor = page.nextCursor
  } while (cursor)

  return rows
}

export interface SupervisorExportHeaders {
  store: string
  product: string
  seller: string
  sellerEmployeeCode: string
  sellerUser: string
  amount: string
  date: string
}

export function mapSalesExportRows(rows: SalesExportRow[], headers: SupervisorExportHeaders): Record<string, string>[] {
  return rows.map(row => ({
    ID: row.id.slice(-6).toUpperCase(),
    [headers.store]: row.venueName,
    [headers.product]: row.product,
    ICCID: row.iccid ?? '',
    [headers.seller]: row.staffName,
    [headers.sellerEmployeeCode]: row.staffEmployeeCode ?? '',
    [headers.sellerUser]: row.staffId ? `ID:${row.staffId.slice(-6).toUpperCase()}` : '',
    [headers.amount]: formatCurrencyForExport(row.amount),
    [headers.date]: formatDateForExport(row.timestamp),
  }))
}

export function shouldPollSupervisorActivity(
  activeTab: string,
  range: { from: Date; to: Date },
  now: Date = new Date(),
): boolean {
  return activeTab === 'operativo' && range.from.getTime() <= now.getTime() && range.to.getTime() >= now.getTime()
}
