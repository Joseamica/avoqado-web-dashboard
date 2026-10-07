import { describe, expect, it } from 'vitest'

import type { IncomeStatementResponse } from '@/services/reports/incomeStatement.service'
import { filasDelExcel } from './estadoDeResultadosExcel'

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key)
const datos = (
  revenue: Partial<IncomeStatementResponse['revenue']>,
  metrics: Partial<IncomeStatementResponse['metrics']> = {},
): IncomeStatementResponse => ({
  venueId: 'v1',
  venueName: 'X',
  currency: 'MXN',
  timezone: 'America/Mexico_City',
  period: { from: '2026-06-01', to: '2026-06-30' },
  taxRateAssumed: 0.16,
  revenue: { grossSalesCents: 18600, refundsCents: 0, netRevenueCents: 18600, taxableBaseCents: 17082, ivaCents: 1518, ...revenue },
  tips: { totalCents: 0 },
  metrics: { salesCount: 1, refundCount: 0, averageTicketCents: 18600, ...metrics },
})
const conceptos = (filas: Array<Record<string, string | number>>) => filas.map(f => f['incomeStatement.concept'])

describe('filasDelExcel (bloque B4b · Codex r1 P3 #9: el contador recibe lo mismo que la pantalla)', () => {
  it('control: con todo al 16 % y exacto, las 6 filas de siempre', () => {
    expect(
      conceptos(filasDelExcel(datos({ taxByRate: { '0.16': 1518 }, movimientosConIvaAproximado: 0 }), t, '2026-06-01', '2026-06-30')),
    ).toEqual([
      'incomeStatement.period',
      'incomeStatement.grossSales',
      'incomeStatement.refunds',
      'incomeStatement.netRevenue',
      'incomeStatement.taxableBase',
      'incomeStatement.iva',
      'ivaPorTasa.nota', // fallo 3 de la ronda 7: la línea fija, siempre
    ])
  })

  it('🔴 con mezcla y movimientos aproximados: el IVA de cada tasa, la base a tasa 0 y el aviso con su número y su explicación', () => {
    const filas = filasDelExcel(
      datos({ taxByRate: { '0.16': 1518 }, tasa0BaseCents: 7592, movimientosConIvaAproximado: 1 }),
      t,
      '2026-06-01',
      '2026-06-30',
    )
    expect(filas.slice(6)).toEqual([
      { 'incomeStatement.concept': 'ivaPorTasa.iva ivaPorTasa.tasa 16', 'incomeStatement.amount': 15.18 },
      { 'incomeStatement.concept': 'ivaPorTasa.baseTasa0', 'incomeStatement.amount': 75.92 },
      { 'incomeStatement.concept': 'ivaPorTasa.aproximadoBadge', 'incomeStatement.amount': 'ivaPorTasa.aproximado 1' },
      { 'incomeStatement.concept': 'ivaPorTasa.nota', 'incomeStatement.amount': 'ivaPorTasa.notaFacturas' },
    ])
  })

  it('🔴 Codex r2 N9 · todo al 8 %: el Excel lleva la fila «IVA 8 %»', () => {
    const filas = filasDelExcel(
      datos({ taxByRate: { '0.08': 800 }, ivaCents: 800, movimientosConIvaAproximado: 0 }),
      t,
      '2026-06-01',
      '2026-06-30',
    )
    expect(filas.slice(6)).toEqual([
      { 'incomeStatement.concept': 'ivaPorTasa.iva ivaPorTasa.tasa 8', 'incomeStatement.amount': 8 },
      { 'incomeStatement.concept': 'ivaPorTasa.nota', 'incomeStatement.amount': 'ivaPorTasa.notaFacturas' },
    ])
  })

  it('🔴 Codex r5 R5-10 · un mes SÓLO con devoluciones exporta su reporte (flujo negativo), con la línea fija', () => {
    const r = {
      grossSalesCents: 0,
      refundsCents: 5000,
      netRevenueCents: -5000,
      taxableBaseCents: -4310,
      ivaCents: -690,
      taxByRate: { '0.16': -690 },
      movimientosConIvaAproximado: 0,
    }
    const filas = filasDelExcel(datos(r, { salesCount: 0, refundCount: 1, averageTicketCents: 0 }), t, '2026-06-01', '2026-06-30')
    expect(filas[2]).toEqual({ 'incomeStatement.concept': 'incomeStatement.refunds', 'incomeStatement.amount': 50 })
    expect(filas[5]).toEqual({ 'incomeStatement.concept': 'incomeStatement.iva', 'incomeStatement.amount': -6.9 })
    expect(filas.slice(6)).toEqual([{ 'incomeStatement.concept': 'ivaPorTasa.nota', 'incomeStatement.amount': 'ivaPorTasa.notaFacturas' }])
  })
})
