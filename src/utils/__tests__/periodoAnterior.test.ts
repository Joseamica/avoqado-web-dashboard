// D4 (30-oct): con la zona real de cada sucursal, la comparación «vs periodo anterior» del Inicio restaba MILISEGUNDOS. Al cruzar
// un cambio de horario (Tijuana, 1-nov) el periodo anterior se corría una hora: «últimos 7 días» comparaba contra desde el 18-oct
// 23:00 en vez del 19-oct 00:00. El periodo anterior se cuenta en DÍAS del negocio.
import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { getPreviousPeriod } from '../datetime'

const dias = (zona: string, desde: string, hasta: string) => ({
  from: DateTime.fromISO(desde, { zone: zona }).startOf('day').toJSDate(),
  to: DateTime.fromISO(hasta, { zone: zona }).endOf('day').toJSDate(),
})
const iso = (r: { from: Date; to: Date }) => ({ from: r.from.toISOString(), to: r.to.toISOString() })

describe('getPreviousPeriod cuenta días del negocio', () => {
  it('Tijuana, «últimos 7 días» el día del cambio de horario: los 7 días anteriores completos', () => {
    const tz = 'America/Tijuana'
    expect(iso(getPreviousPeriod(dias(tz, '2026-10-26', '2026-11-01'), tz))).toEqual(iso(dias(tz, '2026-10-19', '2026-10-25')))
  })

  it('Tijuana, el periodo anterior cae sobre el cambio de horario: también días completos', () => {
    const tz = 'America/Tijuana'
    expect(iso(getPreviousPeriod(dias(tz, '2026-11-02', '2026-11-08'), tz))).toEqual(iso(dias(tz, '2026-10-26', '2026-11-01')))
  })

  it('CDMX, 7 días: los 7 anteriores, igual que antes', () => {
    const tz = 'America/Mexico_City'
    expect(iso(getPreviousPeriod(dias(tz, '2026-10-23', '2026-10-29'), tz))).toEqual({
      from: '2026-10-16T06:00:00.000Z',
      to: '2026-10-23T05:59:59.999Z',
    })
  })

  it('un solo día (Hoy) compara contra el día anterior completo', () => {
    const tz = 'America/Cancun'
    expect(iso(getPreviousPeriod(dias(tz, '2026-10-30', '2026-10-30'), tz))).toEqual(iso(dias(tz, '2026-10-29', '2026-10-29')))
  })

  it('un rango que no es de días completos conserva la misma duración, terminando justo antes (como siempre)', () => {
    const r = { from: new Date('2026-10-16T18:30:00.000Z'), to: new Date('2026-10-30T18:30:00.000Z') }
    expect(iso(getPreviousPeriod(r, 'America/Mexico_City'))).toEqual({
      from: '2026-10-02T18:29:59.999Z',
      to: '2026-10-16T18:29:59.999Z',
    })
  })
})
