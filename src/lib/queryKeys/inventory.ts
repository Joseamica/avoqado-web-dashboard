import type { QueryClient } from '@tanstack/react-query'

export const inventoryKeys = {
  products: (venueId: string) => ['products', venueId] as const,
  productsSummary: (venueId: string) => ['products', venueId, 'inventory-summary'] as const,
  rawMaterials: (venueId: string) => ['rawMaterials', venueId] as const,
  productMovements: (venueId: string, productId: string) =>
    ['productInventoryMovements', venueId, productId] as const,
  rawMaterialMovements: (venueId: string, rawMaterialId: string) =>
    ['stockMovements', venueId, rawMaterialId] as const,
  confirmedStock: (venueId: string) => ['purchase-orders-confirmed-stock', venueId] as const,
}

type StockTarget = { kind: 'product' | 'ingredient'; id: string }

export function invalidateStockOverviewQueries(
  qc: QueryClient,
  venueId: string,
  target: StockTarget,
) {
  qc.invalidateQueries({ queryKey: inventoryKeys.products(venueId) })
  qc.invalidateQueries({ queryKey: inventoryKeys.rawMaterials(venueId) })
  if (target.kind === 'product') {
    qc.invalidateQueries({ queryKey: inventoryKeys.productMovements(venueId, target.id) })
  } else {
    qc.invalidateQueries({ queryKey: inventoryKeys.rawMaterialMovements(venueId, target.id) })
    qc.invalidateQueries({ queryKey: inventoryKeys.confirmedStock(venueId) })
  }
}
