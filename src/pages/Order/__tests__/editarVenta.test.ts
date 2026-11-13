import { describe, expect, it } from 'vitest'
import { cambiosDeLaVenta, fechaParaElCampo, type ValoresDeEdicion } from '../editarVenta'

const base: ValoresDeEdicion = {
  status: 'COMPLETED',
  customerName: 'Ana',
  tableId: 't1',
  servedById: 's1',
  createdAt: '2026-11-13T09:05',
  orderNumber: 'ORD-1',
  type: 'DINE_IN',
}

describe('editar una venta (SUPERADMIN) — D70', () => {
  it('sin cambios no manda nada: la fecha ya no se reenvía (antes perdía los segundos)', () => {
    expect(cambiosDeLaVenta(base, { ...base })).toEqual({})
  })

  it('sólo manda lo que cambió', () => {
    expect(cambiosDeLaVenta(base, { ...base, customerName: 'Luis' })).toEqual({ customerName: 'Luis' })
  })

  it('mesa o mesero vacíos viajan como null', () => {
    expect(cambiosDeLaVenta(base, { ...base, tableId: '', servedById: '' })).toEqual({ tableId: null, servedById: null })
  })

  it('la fecha cambiada se manda como instante completo con zona (lo que se ve es hora local)', () => {
    const r = cambiosDeLaVenta(base, { ...base, createdAt: '2026-11-12T20:30' })
    expect(r).toEqual({ createdAt: new Date('2026-11-12T20:30').toISOString() })
    expect(r.createdAt).toMatch(/Z$/)
  })

  it('el campo muestra la hora LOCAL de la venta (antes mostraba UTC como si fuera local)', () => {
    const venta = new Date(2026, 10, 13, 9, 5, 42) // 13-nov 09:05:42 hora local
    expect(fechaParaElCampo(venta.toISOString())).toBe('2026-11-13T09:05')
    expect(fechaParaElCampo(null)).toBe('')
  })

  it('ida y vuelta: abrir y guardar sin tocar la fecha no la mueve', () => {
    const iso = new Date(2026, 10, 13, 9, 5, 42).toISOString()
    const campo = fechaParaElCampo(iso)
    expect(cambiosDeLaVenta({ ...base, createdAt: campo }, { ...base, createdAt: campo })).toEqual({})
  })
})
