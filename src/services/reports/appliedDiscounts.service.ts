/**
 * Reporte «Descuentos» (encargo f998c8): qué descuentos se dieron en el periodo, agrupados por MOTIVO, y la lista paginada.
 * Habla con `GET /api/v1/dashboard/venues/:venueId/discounts/applied`. Montos en pesos (1:1). El servidor impone el tope de página
 * (100) y siempre manda el total: la tabla pagina, nunca trunca.
 */
import api from '@/api'

/** El valor del filtro para «los que llegaron sin motivo». */
export const SIN_MOTIVO = '__SIN_MOTIVO__'

export interface AppliedDiscountRow {
  id: string
  createdAt: string
  orderId: string
  orderNumber: string | null
  name: string
  type: string
  amount: number
  reason: string | null
  reasonComment: string | null
  appliedBy: string | null
  authorizedBy: string | null
}

export interface AppliedDiscountsReport {
  from: string
  to: string
  totales: { count: number; amount: number }
  porMotivo: Array<{ reason: string | null; count: number; amount: number }>
  motivosRecortados: boolean
  rows: AppliedDiscountRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface AppliedDiscountsFilters {
  venueId: string
  from: string
  to: string
  page: number
  pageSize?: number
  reason?: string
}

export async function fetchAppliedDiscounts(filters: AppliedDiscountsFilters): Promise<AppliedDiscountsReport> {
  const response = await api.get<AppliedDiscountsReport>(`/api/v1/dashboard/venues/${filters.venueId}/discounts/applied`, {
    params: {
      from: filters.from,
      to: filters.to,
      page: filters.page,
      pageSize: filters.pageSize ?? 50,
      ...(filters.reason ? { reason: filters.reason } : {}),
    },
  })
  return response.data
}

export const appliedDiscountsKeys = {
  all: ['applied-discounts'] as const,
  report: (f: AppliedDiscountsFilters) => [...appliedDiscountsKeys.all, f] as const,
}
