/**
 * Activos fijos (Capa B fiscal) service. Gated PREMIUM (CFDI).
 * Depreciación de inversiones (LISR 34-35). Opt-in: registrar un activo = confirmarlo; nada se deprecia solo.
 * Money en CENTAVOS enteros (la UI convierte pesos↔centavos).
 *   GET  /api/v1/dashboard/venues/:venueId/accounting/asset-types
 *   GET  /api/v1/dashboard/venues/:venueId/accounting/fixed-assets
 *   POST /api/v1/dashboard/venues/:venueId/accounting/fixed-assets            (accounting:manage)
 *   POST /api/v1/dashboard/venues/:venueId/accounting/fixed-assets/depreciate (accounting:manage)
 */
import api from '@/api'

export interface AssetTypeDef {
  key: string
  label: string
  annualRate: number
  satRef: string
  satAccountGroup: string
  moiCapCents: number | null
}

export interface FixedAssetView {
  id: string
  organizationId: string
  rfc: string
  venueId: string | null
  description: string
  assetType: string
  assetTypeLabel: string
  moiCents: number
  depreciableBaseCents: number
  annualRate: number
  acquisitionDate: string
  inServiceDate: string
  salvageValueCents: number
  /** Factor INPC capturado (opcional; solo afecta la deducción fiscal, no el libro). */
  inpcFactor?: number | null
  status: string
  sourceExpenseId: string | null
  createdAt: string
}

export interface RegisterFixedAssetInput {
  description: string
  assetType: string
  moiCents: number
  annualRate?: number
  acquisitionDate: string
  inServiceDate?: string
  salvageValueCents?: number
  /** Factor de actualización INPC (art. 31); null lo borra. */
  inpcFactor?: number | null
}

export interface GenerateDepreciationResult {
  needsFiscalSetup: boolean
  period: string
  assetsProcessed: number
  assetsDepreciated: number
  totalPeriodCents: number
  /** Si el asiento contable ya se generó (requiere mapeo de cuentas de depreciación). */
  posted?: boolean
  postedReason?: string
}

export async function getAssetTypes(venueId: string): Promise<AssetTypeDef[]> {
  const res = await api.get<{ assetTypes: AssetTypeDef[] }>(`/api/v1/dashboard/venues/${venueId}/accounting/asset-types`)
  return res.data.assetTypes
}

export async function getFixedAssets(venueId: string): Promise<{ needsFiscalSetup: boolean; assets: FixedAssetView[] }> {
  const res = await api.get<{ needsFiscalSetup: boolean; assets: FixedAssetView[] }>(
    `/api/v1/dashboard/venues/${venueId}/accounting/fixed-assets`,
  )
  return res.data
}

export async function registerFixedAsset(venueId: string, input: RegisterFixedAssetInput): Promise<FixedAssetView> {
  const res = await api.post<FixedAssetView>(`/api/v1/dashboard/venues/${venueId}/accounting/fixed-assets`, input)
  return res.data
}

export async function runDepreciation(venueId: string, period?: string): Promise<GenerateDepreciationResult> {
  const res = await api.post<GenerateDepreciationResult>(
    `/api/v1/dashboard/venues/${venueId}/accounting/fixed-assets/depreciate`,
    period ? { period } : {},
  )
  return res.data
}

/** Edita un activo (mientras siga ACTIVO). Solo se envían/aplican los campos incluidos. */
export async function updateFixedAsset(
  venueId: string,
  assetId: string,
  input: Partial<RegisterFixedAssetInput>,
): Promise<FixedAssetView> {
  const res = await api.patch<FixedAssetView>(`/api/v1/dashboard/venues/${venueId}/accounting/fixed-assets/${assetId}`, input)
  return res.data
}

export interface DisposeResult {
  asset: FixedAssetView
  accumulatedDepreciationCents: number
  bookValueCents: number
  proceedsCents: number
  /** Ganancia (+) o pérdida (−) = precio de venta − valor en libros. */
  gainLossCents: number
  /** Si la póliza de baja se llevó al libro (requiere póliza de alta + cuentas). */
  ledgerPosted?: boolean
  ledgerReason?: string
}

export async function disposeFixedAsset(
  venueId: string,
  assetId: string,
  input: { disposalDate: string; proceedsCents?: number | null },
): Promise<DisposeResult> {
  const res = await api.post<DisposeResult>(`/api/v1/dashboard/venues/${venueId}/accounting/fixed-assets/${assetId}/dispose`, input)
  return res.data
}

export const fixedAssetKeys = {
  all: ['fixedAssets'] as const,
  list: (venueId: string | null) => [...fixedAssetKeys.all, venueId] as const,
  types: (venueId: string | null) => [...fixedAssetKeys.all, 'types', venueId] as const,
}
