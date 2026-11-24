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

  // hz:fefa11b6:D7.1: «Total de las ventas» repetía el número de «Ventas netas» a cuatro renglones; se quitó (Toast tampoco lo
  // tiene en su resumen de EE. UU.). Ya no hay un tercer «total» con el que confundir la cabecera.
  it('ya no existe el renglón «Total de las ventas»', () => {
    expect(s.rows).not.toHaveProperty('totalSales')
    expect(s.tooltips).not.toHaveProperty('totalSales')
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

  it('las tres promesas tienen texto (una vacía no se vería y la prueba de arriba pasaría igual)', () => {
    for (const promesa of [upsell.periods, upsell.breakdowns, upsell.export]) expect(promesa.trim().length).toBeGreaterThan(10)
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

/** Carril F (hz:fefa11b6:D7.3, D7.4, D16.4, D16.6, D16.17): textos de México que dicen lo que el número es. */
describe.each([
  ['es', es],
  ['en', en],
])('Resumen de ventas · textos de la pantalla (%s)', (lang, loc) => {
  const s = loc.salesSummary

  it('el conteo junto a los totales son cobros (una cuenta dividida en 3 pagos cuenta 3), no «transacciones»', () => {
    expect(s.transactionsLabel).toBe(lang === 'es' ? 'cobros' : 'payments')
    expect(s.transactions).toBe(s.transactionsLabel)
  })

  it('sin traducciones de España ni literales: ni «calibre», ni «incrementos individuales», ni «Legacy»', () => {
    const todo = JSON.stringify(s)
    expect(todo).not.toMatch(/calibre|Incrementos individuales|Costes|QR Legacy|Gauge/)
  })

  it('«Devoluciones» ya no dice que excluye las parciales (sí las cuenta)', () => {
    expect(s.controls.metrics.options.refundsDesc).not.toMatch(/excluid|excluding/i)
  })

  it('el título va en minúsculas, como la miga de pan', () => {
    expect(s.title).toBe(lang === 'es' ? 'Resumen de ventas' : 'Sales summary')
  })

  it('los impuestos dicen que ya vienen dentro (México) y no se suman', () => {
    expect(s.tooltips.taxes).toMatch(lang === 'es' ? /dentro de tus precios/ : /inside your prices/)
  })

  // Carril F, regla de parada (Codex r8-r11): el reparto trae datos de varias formas (saldo de regalo y a favor, abonos, cuentas con
  // tarjeta de regalo fuera); su ayuda no afirma qué «entró» ni qué ya resta: sólo que es otra cuenta y qué PUEDE traer.
  it('🔴 el reparto de arriba se titula por método y su ayuda no promete qué entró', () => {
    expect(s.paymentSplit.title).toBe(lang === 'es' ? 'Por método de pago' : 'By payment method')
    expect(s.paymentSplit.tooltip).toMatch(lang === 'es' ? /no es «Neto cobrado»/ : /not «Net collected»/)
    expect(s.paymentSplit.tooltip).not.toMatch(/entró|ya menos|came in|already minus/i)
    expect(s.paymentSplit).not.toHaveProperty('giftCardNote')
  })
})
