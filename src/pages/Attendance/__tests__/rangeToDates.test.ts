import { describe, expect, it } from 'vitest'

import { rangeToDates } from '../Attendance'

/**
 * El rango del historial de asistencia se calcula a partir de "hoy" EN LA ZONA DEL
 * NEGOCIO. La version original restaba dias sobre `new Date('YYYY-MM-DDT00:00:00')`,
 * que interpreta la fecha en la zona de quien mira: desde Tokio la semana empezaba
 * un dia antes que desde Mexico, con el mismo negocio y el mismo dia.
 *
 * Estas pruebas fijan la zona del proceso para que el fallo sea reproducible — es el
 * mismo motivo por el que un test puede pasar en local y tronar en CI.
 */
describe('rangeToDates', () => {
  const TODAY = '2026-08-25'

  it('hoy es un solo dia', () => {
    expect(rangeToDates('today', TODAY)).toEqual({ startDate: TODAY, endDate: TODAY })
  })

  it('7 dias incluye hoy y los seis anteriores', () => {
    expect(rangeToDates('week', TODAY)).toEqual({ startDate: '2026-08-19', endDate: TODAY })
  })

  it('30 dias incluye hoy y los veintinueve anteriores', () => {
    expect(rangeToDates('month', TODAY)).toEqual({ startDate: '2026-07-27', endDate: TODAY })
  })

  it('da el mismo rango sin importar la zona horaria de quien mira', () => {
    const original = process.env.TZ
    const results = new Set<string>()

    for (const tz of ['America/Mexico_City', 'UTC', 'Asia/Tokyo', 'Pacific/Auckland', 'America/Los_Angeles']) {
      process.env.TZ = tz
      results.add(JSON.stringify(rangeToDates('week', TODAY)))
    }

    process.env.TZ = original
    expect(results.size).toBe(1)
  })

  it('cruza bien el cambio de mes', () => {
    expect(rangeToDates('week', '2026-03-03')).toEqual({ startDate: '2026-02-25', endDate: '2026-03-03' })
  })

  it('cruza bien un anio bisiesto', () => {
    // 2028 es bisiesto: siete dias desde el 3 de marzo tienen que tocar el 29 de febrero.
    expect(rangeToDates('week', '2028-03-03')).toEqual({ startDate: '2028-02-26', endDate: '2028-03-03' })
  })
})
