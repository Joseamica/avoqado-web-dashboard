import type { TFunction } from 'i18next'
import type { InventoryProduct, StockOverviewRow } from './types/stock-overview'

/**
 * Filas del Excel de «Resumen de Existencias»: lo mismo que enseña la tabla. El costo no va porque la tabla no lo enseña,
 * y lo que no aplica queda vacío en vez de un 0 inventado. Las cantidades van como número para que Excel las pueda sumar.
 */
export function physicalRowsToExport(rows: StockOverviewRow[], t: TFunction, getUnitLabel: (unit: string) => string) {
  return rows.map(row => ({
    [t('stockExport.columns.item')]: row.name,
    [t('stockExport.columns.kind')]: row.kind === 'ingredient' ? t('stockExport.kinds.ingredient') : t('stockExport.kinds.product'),
    [t('stockExport.columns.sku')]: row.sku ?? '',
    [t('stockExport.columns.available')]: row.stock,
    [t('stockExport.columns.unit')]: row.unitLabel ? getUnitLabel(row.unitLabel) : '',
    [t('stockExport.columns.minimum')]: row.minStock ?? '',
    [t('stockExport.columns.price')]: row.price ?? '',
  }))
}

export function recipeRowsToExport(items: InventoryProduct[], t: TFunction) {
  return items.map(item => ({
    [t('stockExport.columns.item')]: item.name,
    [t('stockExport.columns.sku')]: item.sku ?? '',
    [t('stockExport.columns.theoretical')]: Number(item.availableQuantity || 0),
    [t('stockExport.columns.price')]: Number(item.price),
  }))
}
