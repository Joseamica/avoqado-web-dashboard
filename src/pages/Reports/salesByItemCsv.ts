/**
 * CSV de «Ventas por artículo». Se movió aquí, sin cambiar su salida, desde `handleExportCSV` de SalesByItem.tsx.
 * Puro: el componente sólo arma la descarga con lo que devuelve.
 */
import type { ItemSalesMetrics, SalesByItemResponse } from '@/services/reports/salesByItem.service'

export interface EncabezadosCsv {
  /** Etiqueta de la primera columna (Artículo, o la dimensión de «Mostrar por»). */
  primera: string
  /** Sólo con «Mostrar por: ninguno»: es cuando el reporte trae SKU, categoría y promociones. */
  producto?: { sku: string; categoria: string; promocion: string }
  unidad: string
  articulos: string
  unidades: string
  brutas: string
  descuentos: string
  /** Columna extra al final, sólo cuando `conFamilia`. */
  familia: string
  total: string
}

/** Devuelve el texto completo del archivo (con BOM para que Excel lea bien los acentos). */
export function csvDeVentas(
  filas: ItemSalesMetrics[],
  totales: SalesByItemResponse['totals'],
  encabezados: EncabezadosCsv,
  conFamilia: boolean,
): string {
  const rows: string[][] = []

  const headerRow = [encabezados.primera]
  if (encabezados.producto) {
    // La columna de promoción viaja al CSV: sin ella, exportar el mix pierde
    // justo el dato que explica por qué un producto trae descuento.
    headerRow.push(encabezados.producto.sku, encabezados.producto.categoria, encabezados.producto.promocion)
  }
  headerRow.push(encabezados.unidad, encabezados.articulos, encabezados.unidades, encabezados.brutas, encabezados.descuentos)
  // La familia va AL FINAL: así las columnas de siempre no cambian de lugar cuando el negocio empieza a usar familias.
  if (conFamilia) headerRow.push(encabezados.familia)
  rows.push(headerRow)

  // Plano: un renglón por variante (como Square), cada uno con el nombre de su venta.
  filas.forEach(item => {
    const dataRow = [item.productName]
    if (encabezados.producto) {
      dataRow.push(item.productSku || '', item.categoryName || '', (item.promotions ?? []).map(p => `${p.name} (${p.unitsSold})`).join(' · '))
    }
    dataRow.push(item.unit, item.itemsSold.toString(), item.unitsSold.toString(), item.grossSales.toFixed(2), item.discounts.toFixed(2))
    if (conFamilia) dataRow.push(item.productGroupName || '')
    rows.push(dataRow)
  })

  const totalsRow = [encabezados.total]
  if (encabezados.producto) totalsRow.push('', '', '')
  totalsRow.push('', totales.itemsSold.toString(), totales.unitsSold.toString(), totales.grossSales.toFixed(2), totales.discounts.toFixed(2))
  if (conFamilia) totalsRow.push('')
  rows.push(totalsRow)

  // RFC 4180: una comilla dentro de la celda se duplica (antes, un nombre como Playera "Clásica" partía el renglón).
  return '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}
