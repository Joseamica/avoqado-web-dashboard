/**
 * Libro diario · Pólizas service — gated PREMIUM (bundle con CFDI).
 *
 *   GET  /api/v1/dashboard/venues/:venueId/accounting/journal?period=YYYY-MM
 *   POST …/accounting/journal   body: { date, concept, lines: [{ ledgerAccountId, debitCents, creditCents, description? }] }
 *
 * Money en CENTAVOS enteros. Cada póliza cuadra: totalDebitCents == totalCreditCents.
 */
import api from '@/api'

export interface JournalLineDTO {
  id: string
  ledgerAccountId: string
  accountCode: string
  accountName: string
  debitCents: number
  creditCents: number
  description: string | null
}

export interface JournalEntryDTO {
  id: string
  date: string
  period: string
  folio: number
  type: string
  source: string
  status: string
  concept: string
  totalDebitCents: number
  totalCreditCents: number
  lines: JournalLineDTO[]
}

export interface JournalResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  entries: JournalEntryDTO[]
}

export interface NewLine {
  ledgerAccountId: string
  debitCents: number
  creditCents: number
  description?: string | null
}

export interface NewEntry {
  date: string
  concept: string
  lines: NewLine[]
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/journal`

export async function getJournal(venueId: string, period?: string): Promise<JournalResponse> {
  const res = await api.get<JournalResponse>(base(venueId), { params: period ? { period } : {} })
  return res.data
}

export async function createJournalEntry(venueId: string, entry: NewEntry): Promise<JournalEntryDTO> {
  const res = await api.post<JournalEntryDTO>(base(venueId), entry)
  return res.data
}

export const journalKeys = {
  all: ['journal'] as const,
  list: (venueId: string | null, period?: string) => [...journalKeys.all, venueId, period ?? 'all'] as const,
}
