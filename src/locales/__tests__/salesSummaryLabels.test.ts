/**
 * D16 (Reportes › Resumen de ventas): la cifra grande de arriba es `summary.totalCollected`, la MISMA que el renglón
 * «Total cobrado». Se llamaba «Total de Ventas» y, en la misma pantalla, «Total de las ventas» mostraba otra cifra (netSales):
 * dos nombres casi iguales con números distintos. Misma cifra ⇒ mismo nombre; cifra distinta ⇒ nombre distinto.
 */
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/reports.json'
import en from '@/locales/en/reports.json'

describe.each([
  ['es', es],
  ['en', en],
])('Resumen de ventas · nombres de los totales (%s)', (_, loc) => {
  const s = loc.salesSummary

  it('la cabecera se llama como el renglón que muestra su misma cifra («Total cobrado»)', () => {
    expect(s.totalSales).toBe(s.rows.totalCollected)
  })

  it('la cabecera no se confunde con «Total de las ventas» (ventas netas, otra cifra)', () => {
    expect(s.totalSales.toLowerCase()).not.toBe(s.rows.totalSales.toLowerCase())
  })

  it('«Artículos» ya no dice que excluye impuestos: en México el precio trae el IVA', () => {
    expect(s.tooltips.items).not.toMatch(/sin incluir impuestos|excluding taxes/i)
    expect(s.controls.metrics.options.itemsDesc).not.toMatch(/sin incluir impuestos|excluding taxes/i)
  })
})
