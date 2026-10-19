/**
 * Reporte «Ventas por artículo»: junta en UNA fila los renglones que son variantes de la misma familia
 * (spec de variantes §9, «Reportes»). Puro: sin React ni red.
 *
 * El server manda un renglón por variante (con el nombre de la venta) y, sólo con «Mostrar por: ninguno», la familia
 * ACTUAL en `productGroupId`/`productGroupName`. Aquí se suma por familia; los totales del pie NO se recalculan
 * (salen del server).
 */
import type { ItemSalesMetrics } from '@/services/reports/salesByItem.service'

export type CampoOrden = 'productName' | 'categoryName' | 'itemsSold' | 'unitsSold' | 'grossSales' | 'discounts' | 'netSales'
export interface OrdenVentas {
  field: CampoOrden
  direction: 'asc' | 'desc'
}

export type FilaDeVentas =
  | { tipo: 'familia'; groupId: string; nombre: string; metricas: ItemSalesMetrics; variantes: ItemSalesMetrics[] }
  | { tipo: 'articulo'; item: ItemSalesMetrics }

/** El comparador de siempre de la tabla (texto con `localeCompare`; lo demás, numérico). */
function comparador(orden: OrdenVentas) {
  return (a: ItemSalesMetrics, b: ItemSalesMetrics) => {
    const aValue = a[orden.field]
    const bValue = b[orden.field]
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return orden.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    const numA = Number(aValue) || 0
    const numB = Number(bValue) || 0
    return orden.direction === 'asc' ? numA - numB : numB - numA
  }
}

/** Une las promociones de las variantes por nombre, sumando (el orden es el de la primera aparición). */
function fusionarPromociones(variantes: ItemSalesMetrics[]) {
  const porNombre = new Map<string, { name: string; unitsSold: number; netSales: number }>()
  for (const v of variantes) {
    for (const p of v.promotions ?? []) {
      const previa = porNombre.get(p.name)
      if (previa) {
        previa.unitsSold += p.unitsSold
        previa.netSales += p.netSales
      } else {
        porNombre.set(p.name, { ...p })
      }
    }
  }
  return [...porNombre.values()]
}

function armarFamilia(groupId: string, variantes: ItemSalesMetrics[]): Extract<FilaDeVentas, { tipo: 'familia' }> {
  const primera = variantes[0]
  const nombre = variantes.find(v => v.productGroupName)?.productGroupName ?? primera.productName
  const suma = (campo: 'itemsSold' | 'unitsSold' | 'grossSales' | 'discounts' | 'netSales') =>
    variantes.reduce((acc, v) => acc + v[campo], 0)
  const promotions = fusionarPromociones(variantes)
  const metricas: ItemSalesMetrics = {
    productId: null,
    productName: nombre,
    productSku: null,
    // la categoría sólo se muestra si todas las variantes coinciden
    categoryName: variantes.every(v => v.categoryName === primera.categoryName) ? primera.categoryName : null,
    unit: primera.unit,
    itemsSold: suma('itemsSold'),
    unitsSold: suma('unitsSold'),
    grossSales: suma('grossSales'),
    discounts: suma('discounts'),
    netSales: suma('netSales'),
    productGroupId: groupId,
    productGroupName: nombre,
    // misma convención que el server: `promotionName` = la única promoción; `null` si fueron varias
    ...(promotions.length > 0 ? { promotions, promotionName: promotions.length === 1 ? promotions[0].name : null } : {}),
  }
  return { tipo: 'familia', groupId, nombre, metricas, variantes }
}

/**
 * Sin ningún `productGroupId` devuelve cada renglón como `articulo`, en el mismo orden que daba la tabla de siempre.
 * Con familias, el `orden` aplica a las filas de arriba (familias y sueltos juntos) y, dentro de cada familia, a sus variantes.
 */
export function agruparVentasPorFamilia(items: ItemSalesMetrics[], orden: OrdenVentas): FilaDeVentas[] {
  const cmp = comparador(orden)
  const sueltosYFamilias: Array<{ item: ItemSalesMetrics } | { groupId: string; variantes: ItemSalesMetrics[] }> = []
  const porFamilia = new Map<string, { groupId: string; variantes: ItemSalesMetrics[] }>()

  for (const item of items) {
    const groupId = item.productGroupId
    if (!groupId) {
      sueltosYFamilias.push({ item })
      continue
    }
    let familia = porFamilia.get(groupId)
    if (!familia) {
      familia = { groupId, variantes: [] }
      porFamilia.set(groupId, familia)
      sueltosYFamilias.push(familia)
    }
    familia.variantes.push(item)
  }

  const filas: FilaDeVentas[] = sueltosYFamilias.map(f =>
    'item' in f ? { tipo: 'articulo', item: f.item } : armarFamilia(f.groupId, [...f.variantes].sort(cmp)),
  )
  return filas.sort((a, b) => cmp(a.tipo === 'familia' ? a.metricas : a.item, b.tipo === 'familia' ? b.metricas : b.item))
}
