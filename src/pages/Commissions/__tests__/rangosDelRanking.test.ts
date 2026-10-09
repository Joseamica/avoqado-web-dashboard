// ft-graves, hermano de D-D2: el ranking del equipo cortaba «esta semana», «esta quincena», «este mes» y «este trimestre» con la
// zona del NAVEGADOR. Los resúmenes los corta el servidor en la zona del negocio: de noche en México (o con el navegador en otra
// zona) el ranking ya contaba el mes siguiente. Los rangos se cortan en la zona del negocio.
import { afterEach, describe, expect, it } from 'vitest'
import { rangosDelRanking } from '../rangosDelRanking'

const MX = 'America/Mexico_City'
// 30-sep-2026 a las 21:00 en México = 1-oct 03:00 UTC: en México todavía es septiembre (un miércoles).
const NOCHE_DEL_30 = new Date('2026-10-01T03:00:00.000Z')
const zonaOriginal = process.env.TZ
afterEach(() => {
  process.env.TZ = zonaOriginal
})
const iso = (r: { start: Date; end: Date } | null) => r && { start: r.start.toISOString(), end: r.end.toISOString() }

describe.each(['UTC', 'Europe/Madrid'])('navegador en %s, negocio en México, 30-sep a las 21:00', zonaDelNavegador => {
  it('🔴 «este mes» es septiembre en México y «el anterior», agosto', () => {
    process.env.TZ = zonaDelNavegador
    const r = rangosDelRanking('month', MX, NOCHE_DEL_30)
    expect(iso(r.current)).toEqual({ start: '2026-09-01T06:00:00.000Z', end: '2026-10-01T05:59:59.999Z' })
    expect(iso(r.previous)).toEqual({ start: '2026-08-01T06:00:00.000Z', end: '2026-09-01T05:59:59.999Z' })
  })

  it('🔴 «esta semana» va de lunes 28-sep a domingo 4-oct en México', () => {
    process.env.TZ = zonaDelNavegador
    const r = rangosDelRanking('week', MX, NOCHE_DEL_30)
    expect(iso(r.current)).toEqual({ start: '2026-09-28T06:00:00.000Z', end: '2026-10-05T05:59:59.999Z' })
    expect(iso(r.previous)?.start).toBe('2026-09-21T06:00:00.000Z')
  })

  it('🔴 «esta quincena» es del 16 al 30 de septiembre y la anterior del 1 al 15', () => {
    process.env.TZ = zonaDelNavegador
    const r = rangosDelRanking('biweek', MX, NOCHE_DEL_30)
    expect(iso(r.current)).toEqual({ start: '2026-09-16T06:00:00.000Z', end: '2026-10-01T05:59:59.999Z' })
    expect(iso(r.previous)).toEqual({ start: '2026-09-01T06:00:00.000Z', end: '2026-09-16T05:59:59.999Z' })
  })

  it('🔴 «este trimestre» es jul-sep en México', () => {
    process.env.TZ = zonaDelNavegador
    const r = rangosDelRanking('quarter', MX, NOCHE_DEL_30)
    expect(iso(r.current)).toEqual({ start: '2026-07-01T06:00:00.000Z', end: '2026-10-01T05:59:59.999Z' })
    expect(iso(r.previous)?.start).toBe('2026-04-01T06:00:00.000Z')
  })
})

it('la primera quincena: la anterior es la segunda mitad del mes pasado', () => {
  const r = rangosDelRanking('biweek', MX, new Date('2026-10-10T18:00:00.000Z'))
  expect(iso(r.current)).toEqual({ start: '2026-10-01T06:00:00.000Z', end: '2026-10-16T05:59:59.999Z' })
  expect(iso(r.previous)).toEqual({ start: '2026-09-16T06:00:00.000Z', end: '2026-10-01T05:59:59.999Z' })
})

it('«todo» no tiene periodo anterior', () => {
  const r = rangosDelRanking('all', MX, NOCHE_DEL_30)
  expect(r.previous).toBeNull()
  expect(r.current.end.toISOString()).toBe(NOCHE_DEL_30.toISOString())
})
