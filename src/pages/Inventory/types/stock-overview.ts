import type { RawMaterial } from '@/services/inventory.service'
import type { VariantOption } from '@/types/productGroup'

export interface InventoryProduct {
  id: string
  name: string
  sku?: string | null
  price: number | string
  cost?: number | string | null
  trackInventory: boolean
  inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
  availableQuantity?: number | string | null
  inventory?: {
    minimumStock?: number | null
  } | null
  /** Variantes: la familia del producto (null/ausente = suelto) y sus valores («Talla: M»), como los manda GET /products. */
  productGroupId?: string | null
  productGroupName?: string | null
  variantOptions?: VariantOption[] | null
}

export type StockOverviewRowKind = 'product' | 'ingredient'

export interface StockOverviewRow {
  id: string
  kind: StockOverviewRowKind
  name: string
  sku: string | null
  unitLabel: string | null
  stock: number
  minStock: number | null
  cost: number | null
  price: number | null
  /** Confirmed stock from in-transit purchase orders. Only available for ingredients. */
  confirmedStock: number | null
  /** Reference to the raw entity for mutations / dialogs. */
  source: InventoryProduct | RawMaterial
  /** Variantes (sólo productos): para agrupar la familia en una fila y ordenar sus variantes por opción. */
  productGroupId?: string | null
  productGroupName?: string | null
  variantOptions?: VariantOption[] | null
}

export function productToStockOverviewRow(p: InventoryProduct): StockOverviewRow {
  return {
    id: p.id,
    kind: 'product',
    name: p.name,
    sku: p.sku ?? null,
    unitLabel: null,
    stock: Number(p.availableQuantity || 0),
    minStock: p.inventory?.minimumStock != null ? Number(p.inventory.minimumStock) : null,
    cost: p.cost != null ? Number(p.cost) : null,
    price: Number(p.price) || 0,
    confirmedStock: null,
    source: p,
    productGroupId: p.productGroupId ?? null,
    productGroupName: p.productGroupName ?? null,
    variantOptions: p.variantOptions ?? null,
  }
}

export function rawMaterialToStockOverviewRow(r: RawMaterial): StockOverviewRow {
  return {
    id: r.id,
    kind: 'ingredient',
    name: r.name,
    sku: r.sku ?? null,
    unitLabel: r.unit,
    stock: Number(r.currentStock || 0),
    minStock: r.reorderPoint != null ? Number(r.reorderPoint) : null,
    cost: r.costPerUnit != null ? Number(r.costPerUnit) : null,
    price: null,
    confirmedStock: null,
    source: r,
  }
}

export function isProductRow(
  row: StockOverviewRow,
): row is StockOverviewRow & { source: InventoryProduct } {
  return row.kind === 'product'
}

export function isIngredientRow(
  row: StockOverviewRow,
): row is StockOverviewRow & { source: RawMaterial } {
  return row.kind === 'ingredient'
}
