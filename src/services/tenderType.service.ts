import api from '@/api'

// Tipos de pago personalizados (VenueTenderType, slice A1) — catálogo core/FREE.
// El POS aún NO los consume (slice B); esta pantalla es el switch canónico.
// Base: /api/v1/dashboard/venues/${venueId}/tender-types

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/tender-types`

// ── Types (backend mirror) ───────────────────────────────────────────────────

export type TenderPosSection = 'PRIMARY' | 'MORE'

export interface TenderType {
  id: string
  venueId: string
  name: string
  normalizedName: string
  /** System rows mirror the built-in methods; custom rows are always OTHER. */
  baseMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET' | 'BANK_TRANSFER' | 'CRYPTOCURRENCY' | 'OTHER'
  isSystem: boolean
  countsAsPhysicalCash: boolean
  captureTip: boolean
  showOnPos: boolean
  posSection: TenderPosSection
  displayOrder: number
  commissionPercent: string | number | null
  satFormaPago: string | null
  linkedOrderSource: string | null
  active: boolean
  /** Money-semantic version — send back as expectedRevision on every update (409 if stale). */
  revision: number
  createdAt: string
  updatedAt: string
}

export interface CreateTenderTypeInput {
  name: string
  countsAsPhysicalCash?: boolean
  captureTip?: boolean
  showOnPos?: boolean
  posSection?: TenderPosSection
  commissionPercent?: number | null
  satFormaPago?: string | null
}

export interface UpdateTenderTypeInput {
  expectedRevision: number
  name?: string
  countsAsPhysicalCash?: boolean
  captureTip?: boolean
  showOnPos?: boolean
  posSection?: TenderPosSection
  displayOrder?: number
  commissionPercent?: number | null
  satFormaPago?: string | null
  active?: boolean
}

// ── Calls ────────────────────────────────────────────────────────────────────

export async function listTenderTypes(venueId: string): Promise<TenderType[]> {
  const res = await api.get(base(venueId))
  return res.data.tenderTypes
}

/**
 * Comisiones pagadas por tipo de pago. Los montos vienen en PESOS y la comisión es la
 * CONGELADA en cada cobro — cambiar el porcentaje hoy NO reescribe lo del mes pasado.
 */
export interface TenderCommissionRow {
  tenderTypeId: string
  tenderLabel: string
  count: number
  gross: number
  commission: number
  net: number
}

export interface TenderCommissionsReport {
  from: string
  to: string
  rows: TenderCommissionRow[]
  totalGross: number
  totalCommission: number
  totalNet: number
}

export async function getTenderCommissions(venueId: string, params?: { from?: string; to?: string }): Promise<TenderCommissionsReport> {
  const res = await api.get(`${base(venueId)}/commissions`, { params })
  return res.data
}

export async function createTenderType(venueId: string, input: CreateTenderTypeInput): Promise<TenderType> {
  const res = await api.post(base(venueId), input)
  return res.data.tenderType
}

export async function updateTenderType(venueId: string, tenderTypeId: string, input: UpdateTenderTypeInput): Promise<TenderType> {
  const res = await api.patch(`${base(venueId)}/${tenderTypeId}`, input)
  return res.data.tenderType
}
