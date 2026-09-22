import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { wasteDateRange } from './wasteDateRange'

const TZ = 'America/Mexico_City' // −06:00 todo el año desde 2022
const now = DateTime.fromISO('2026-09-22T10:00:00', { zone: TZ })

describe('wasteDateRange — lo que acepta GET …/waste-reports (ISO CON zona, día del NEGOCIO)', () => {
  it('sin filtro no manda fechas', () => {
    expect(wasteDateRange(null, TZ, now)).toEqual({})
  })
  it('«el día»: de 00:00:00.000 a 23:59:59.999 en la zona del negocio', () => {
    expect(wasteDateRange({ operator: 'on', value: '2026-09-01' }, TZ, now)).toEqual({
      startDate: '2026-09-01T00:00:00.000-06:00',
      endDate: '2026-09-01T23:59:59.999-06:00',
    })
  })
  it('«entre»: ambos días completos, aunque vengan al revés', () => {
    expect(wasteDateRange({ operator: 'between', value: '2026-09-10', value2: '2026-09-01' }, TZ, now)).toEqual({
      startDate: '2026-09-01T00:00:00.000-06:00',
      endDate: '2026-09-10T23:59:59.999-06:00',
    })
  })
  it('«antes de»: hasta el final del día anterior', () => {
    expect(wasteDateRange({ operator: 'before', value: '2026-09-10' }, TZ, now)).toEqual({ endDate: '2026-09-09T23:59:59.999-06:00' })
  })
  it('«después de»: desde el inicio del día siguiente', () => {
    expect(wasteDateRange({ operator: 'after', value: '2026-09-10' }, TZ, now)).toEqual({ startDate: '2026-09-11T00:00:00.000-06:00' })
  })
  it('«últimos N»: desde ahora menos N, en la zona del negocio', () => {
    expect(wasteDateRange({ operator: 'last', value: 7, unit: 'days' }, TZ, now)).toEqual({ startDate: '2026-09-15T10:00:00.000-06:00' })
    expect(wasteDateRange({ operator: 'last', value: '2', unit: 'hours' }, TZ, now)).toEqual({ startDate: '2026-09-22T08:00:00.000-06:00' })
  })
  it('una fecha inválida o vacía no filtra (nunca manda texto sin zona)', () => {
    expect(wasteDateRange({ operator: 'on', value: 'no-es-fecha' }, TZ, now)).toEqual({})
    expect(wasteDateRange({ operator: 'between', value: '2026-09-01', value2: null }, TZ, now)).toEqual({})
    expect(wasteDateRange({ operator: 'last', value: 0, unit: 'days' }, TZ, now)).toEqual({})
  })
})
