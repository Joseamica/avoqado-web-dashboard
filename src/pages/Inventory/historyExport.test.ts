import { describe, expect, it } from 'vitest'
import { DIAS_POR_OMISION, filtrosQueNoLleganAlArchivo, rangoInicialDelExporte } from './historyExport'

const ahora = new Date(2026, 10, 12, 15, 30, 0, 0) // 12-nov-2026 15:30 hora local

describe('rangoInicialDelExporte', () => {
  it('sin filtro de fecha: los últimos 30 días hasta ahora', () => {
    const r = rangoInicialDelExporte(null, ahora)
    expect(r.to).toEqual(ahora)
    expect(r.from).toEqual(new Date(2026, 9, 13, 0, 0, 0, 0))
    expect(DIAS_POR_OMISION).toBe(30)
  })

  it('«últimos 7 días» de la página: desde hace 7 días hasta ahora', () => {
    const r = rangoInicialDelExporte({ operator: 'last', value: 7, unit: 'days' }, ahora)
    expect(r).toEqual({ from: new Date(2026, 10, 5, 15, 30), to: ahora })
  })

  it('«últimas 2 semanas» y «últimas 3 horas»', () => {
    expect(rangoInicialDelExporte({ operator: 'last', value: 2, unit: 'weeks' }, ahora).from).toEqual(new Date(2026, 9, 29, 15, 30))
    expect(rangoInicialDelExporte({ operator: 'last', value: '3', unit: 'hours' }, ahora).from).toEqual(new Date(2026, 10, 12, 12, 30))
  })

  it('«entre» incluye el último día completo', () => {
    const r = rangoInicialDelExporte({ operator: 'between', value: '2026-11-01T00:00:00', value2: '2026-11-05T00:00:00' }, ahora)
    expect(r).toEqual({ from: new Date(2026, 10, 1, 0, 0), to: new Date(2026, 10, 5, 23, 59, 59, 999) })
  })

  it('«el día» es ese día completo', () => {
    const r = rangoInicialDelExporte({ operator: 'on', value: '2026-11-03T10:00:00' }, ahora)
    expect(r).toEqual({ from: new Date(2026, 10, 3, 0, 0), to: new Date(2026, 10, 3, 23, 59, 59, 999) })
  })

  it('«después de» llega hasta ahora; «antes de» propone 30 días previos', () => {
    expect(rangoInicialDelExporte({ operator: 'after', value: '2026-11-10T00:00:00' }, ahora)).toEqual({
      from: new Date(2026, 10, 10),
      to: ahora,
    })
    const antes = rangoInicialDelExporte({ operator: 'before', value: '2026-11-10T00:00:00' }, ahora)
    expect(antes.to).toEqual(new Date(2026, 10, 10))
    expect(antes.from).toEqual(new Date(2026, 9, 11, 0, 0))
  })

  it('un filtro que no se puede leer cae en los 30 días, nunca en una fecha inválida', () => {
    for (const f of [
      { operator: 'between' as const, value: 'no', value2: null },
      { operator: 'on' as const, value: null },
      { operator: 'last' as const, value: 0, unit: 'days' as const },
    ]) {
      const r = rangoInicialDelExporte(f, ahora)
      expect(Number.isNaN(r.from.getTime())).toBe(false)
      expect(r.to).toEqual(ahora)
    }
  })
})

describe('filtrosQueNoLleganAlArchivo', () => {
  it('sin filtros de página, nada se queda fuera', () => {
    expect(filtrosQueNoLleganAlArchivo({ sku: [], proveedor: [], costeTotal: null, tipos: [] })).toEqual([])
    expect(filtrosQueNoLleganAlArchivo({ sku: [], proveedor: [], costeTotal: null, tipos: ['SALE'] })).toEqual([])
  })

  it('SKU, proveedor, coste y varios tipos se avisan', () => {
    expect(
      filtrosQueNoLleganAlArchivo({ sku: ['A'], proveedor: ['X'], costeTotal: { operator: 'gt', value: 1 }, tipos: ['SALE', 'COUNT'] }),
    ).toEqual(['sku', 'provider', 'totalCost', 'type'])
  })
})
