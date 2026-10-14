import { describe, expect, it } from 'vitest'
import { COLUMNAS, diasDelRango, motivoDeBloqueo, rangoRapido } from '@/pages/AvailableBalance/settlementReportColumns'

describe('rangoRapido (zona del venue, no del navegador)', () => {
  const hoy = new Date('2026-10-01T03:00:00Z') // 30-sep 21:00 en CDMX
  it('este mes / mes pasado / últimos 30 días', () => {
    expect(rangoRapido('esteMes', 'America/Mexico_City', hoy)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(rangoRapido('mesPasado', 'America/Mexico_City', hoy)).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31' })
    expect(rangoRapido('ultimos30', 'America/Mexico_City', hoy)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' })
  })
})
describe('motivoDeBloqueo', () => {
  const caps = { xlsx: 5000, csv: 10000 }
  it('rango largo, demasiados para Excel (ofrece CSV) y demasiados para todo', () => {
    expect(motivoDeBloqueo({ dias: 93, candidatos: 10, format: 'xlsx', caps })).toEqual({ key: 'rangoLargo' })
    expect(motivoDeBloqueo({ dias: 31, candidatos: 6000, format: 'xlsx', caps })).toEqual({ key: 'demasiadosExcel', count: 6000 })
    expect(motivoDeBloqueo({ dias: 31, candidatos: 6000, format: 'csv', caps })).toBeNull()
    expect(motivoDeBloqueo({ dias: 31, candidatos: 12000, format: 'csv', caps })).toEqual({ key: 'demasiados', count: 12000 })
    expect(motivoDeBloqueo({ dias: 31, candidatos: undefined, format: 'csv', caps })).toBeNull()
  })
})
it('diasDelRango es inclusivo', () => expect(diasDelRango('2026-08-01', '2026-08-31')).toBe(31))
it('la fecha estimada es obligatoria en los dos reportes', () => {
  for (const k of ['transactions', 'deposits'] as const) expect(COLUMNAS[k].find(c => c.id === 'fechaDeposito')?.required).toBe(true)
})
