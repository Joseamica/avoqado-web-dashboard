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

  it('la cabecera se llama como el renglón que muestra su misma cifra («Neto cobrado»)', () => {
    expect(s.totalSales).toBe(s.rows.totalCollected)
  })

  // Founder (5-nov, «A»): es lo cobrado DESPUÉS de comisiones, como el «Net total» de Square; no se confunde con «Cobraste».
  it('esa cifra se llama «Neto cobrado» (Net collected)', () => {
    expect(s.rows.totalCollected).toBe(_ === 'es' ? 'Neto cobrado' : 'Net collected')
    expect(s.controls.metrics.options.totalCollected).toBe(s.rows.totalCollected)
  })

  it('la cabecera no se confunde con «Total de las ventas» (ventas netas, otra cifra)', () => {
    expect(s.totalSales.toLowerCase()).not.toBe(s.rows.totalSales.toLowerCase())
  })

  it('«Artículos» ya no dice que excluye impuestos: en México el precio trae el IVA', () => {
    expect(s.tooltips.items).not.toMatch(/sin incluir impuestos|excluding taxes/i)
    expect(s.controls.metrics.options.itemsDesc).not.toMatch(/sin incluir impuestos|excluding taxes/i)
  })
})

/**
 * D3 (Resumen de ventas): el aviso del plan Gratis prometía «desgloses por terminal» (no existen) y «exporta a CSV» (también hay
 * Excel y PDF), y «compara periodos» (se ven las ventas por hora, día, semana y mes, sin comparar). Y los textos de tres controles que
 * ya no están en la pantalla («Terminales», «Agrupar las métricas por» y el icono de gráfica por métrica) se quitan con ellos.
 */
describe.each([
  ['es', es],
  ['en', en],
])('Resumen de ventas · el aviso del plan Gratis sólo promete lo que hay (%s)', (_, loc) => {
  const { upsell } = loc.salesSummary.basic

  it('no promete desgloses por terminal: no existen', () => {
    expect(upsell.breakdowns).not.toMatch(/terminal/i)
  })

  it('dice los tres formatos de exporte que sí hay', () => {
    for (const formato of ['Excel', 'CSV', 'PDF']) expect(upsell.export).toContain(formato)
  })

  it('no dice que compara periodos: sólo se ven las ventas por hora, día, semana y mes', () => {
    expect(upsell.periods).not.toMatch(/compar/i)
  })

  it('los textos de los controles que ya no existen se fueron con ellos', () => {
    const { controls } = loc.salesSummary
    expect(controls).not.toHaveProperty('terminal')
    expect(controls).not.toHaveProperty('groupBy')
    expect(controls.metrics).not.toHaveProperty('chartHint')
  })
})
