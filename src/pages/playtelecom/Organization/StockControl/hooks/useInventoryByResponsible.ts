import { useQuery } from '@tanstack/react-query'
import {
  getOrgInventoryByResponsible,
  type InventoryByResponsible,
  type InventoryByResponsibleParams,
} from '@/services/stockDashboard.service'

/**
 * Tabla Ciudad › Supervisor › Promotor del Control de Stock.
 *
 * Mismo criterio de frescura que `useOrgStockControl`: es la pantalla con la que
 * un supervisor cuenta SIMs parado en la tienda, así que un dato viejo le hace
 * cuadrar mal el conteo físico.
 */
export function useInventoryByResponsible(orgId: string | undefined, params: InventoryByResponsibleParams) {
  return useQuery<InventoryByResponsible>({
    queryKey: [
      'org-inventory-by-responsible',
      orgId,
      params.dateFrom ?? null,
      params.dateTo ?? null,
      params.receivingVenueId ?? null,
      params.categoryId ?? null,
    ],
    queryFn: () => getOrgInventoryByResponsible(orgId!, params),
    enabled: !!orgId,
    staleTime: 10_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
