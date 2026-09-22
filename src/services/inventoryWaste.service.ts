import api from '@/api'

export type WasteCostState = 'KNOWN' | 'PARTIAL' | 'UNKNOWN' | 'NONE'
export type WasteSource = 'POS' | 'DASHBOARD' | 'MCP'

/**
 * Una declaración de merma tal como la devuelve el servidor (fase 1). Decimales y montos llegan
 * como TEXTO, montos en pesos. `costImpact` es la MAGNITUD positiva de la pérdida.
 */
export interface WasteReport {
  id: string
  itemType: 'RAW_MATERIAL' | 'PRODUCT'
  rawMaterialId: string | null
  productId: string | null
  unit: string | null
  reasonCode: string | null
  declaredQuantity: string | null
  deductedQuantity: string
  unrecordedQuantity: string
  costImpact: string | null
  costState: WasteCostState
  unitCostSnapshot: string | null
  note: string | null
  reference: string | null
  supplier: string | null
  source: WasteSource
  createdAt: string
  clientOccurredAt: string | null
  reportedByStaffId: string
  reportedByStaff: { firstName: string; lastName: string } | null
  rawMaterial: { name: string; sku: string | null } | null
  product: { name: string; sku: string | null } | null
}

export interface WasteReportsPage {
  items: WasteReport[]
  total: number
  page: number
  pageSize: number
}

export interface WasteReportsQuery {
  page: number
  pageSize: number
  search?: string
  /** ISO 8601 CON zona (p. ej. 2026-09-01T00:00:00.000-06:00). Sin zona el servidor responde 422. */
  startDate?: string
  endDate?: string
}

/** El servidor recorta a 200 (nunca rechaza); aquí se respeta el mismo tope. */
export const WASTE_REPORTS_MAX_PAGE_SIZE = 200
/** Más de 200 caracteres de búsqueda ⇒ 422 del servidor. */
export const WASTE_SEARCH_MAX_LENGTH = 200

export const wasteReportsApi = {
  async list(venueId: string, query: WasteReportsQuery, signal?: AbortSignal): Promise<WasteReportsPage> {
    const search = query.search?.trim().slice(0, WASTE_SEARCH_MAX_LENGTH)
    const params: WasteReportsQuery = {
      ...query,
      pageSize: Math.min(query.pageSize, WASTE_REPORTS_MAX_PAGE_SIZE),
    }
    if (search) params.search = search
    else delete params.search
    const response = await api.get<{ success: boolean; data: WasteReportsPage }>(
      `/api/v1/dashboard/venues/${venueId}/inventory/waste-reports`,
      { params, signal },
    )
    return response.data.data
  },
}
