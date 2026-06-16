/**
 * Bank Reconciliation (Conciliación bancaria) service — Feature PRO.
 * Sube estado de cuenta CSV → concilia contra lo que Avoqado depositó.
 * Money fields come back as INTEGER CENTS (amountCents). Backend returns objects directly.
 */
import api from '@/api'

export type ReconMatchStatus = 'UNMATCHED' | 'MATCHED' | 'DUPLICATE' | 'CONFIRMED'

export interface BankStatementSummary {
  id: string
  fileName: string
  status: string
  periodStart: string | null
  periodEnd: string | null
  lineCount: number
  matchedCount: number
  createdAt: string
}

export interface BankStatementLine {
  id: string
  rowIndex: number
  postedDate: string
  description: string
  reference: string | null
  amountCents: number
  direction: 'CREDIT' | 'DEBIT'
  matchStatus: ReconMatchStatus
  matchScore: string | null
  matchedKey: string | null
}

export interface BankStatementDetail extends BankStatementSummary {
  lines: BankStatementLine[]
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/bank-reconciliation/statements`

export async function uploadBankStatement(
  venueId: string,
  file: File,
): Promise<{ statementId: string; lineCount: number; matchedCount: number }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await api.post(base(venueId), fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data
}

export async function listBankStatements(venueId: string): Promise<BankStatementSummary[]> {
  const res = await api.get<BankStatementSummary[]>(base(venueId))
  return res.data
}

export async function getBankStatement(venueId: string, statementId: string): Promise<BankStatementDetail> {
  const res = await api.get<BankStatementDetail>(`${base(venueId)}/${statementId}`)
  return res.data
}

export async function confirmBankMatches(venueId: string, statementId: string, lineIds: string[]): Promise<{ confirmed: number }> {
  const res = await api.post(`${base(venueId)}/${statementId}/confirm`, { lineIds })
  return res.data
}

export const bankReconKeys = {
  all: ['bankReconciliation'] as const,
  list: (venueId: string | null) => [...bankReconKeys.all, 'list', venueId] as const,
  detail: (venueId: string | null, id: string) => [...bankReconKeys.all, 'detail', venueId, id] as const,
}
