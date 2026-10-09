// ft-graves, D-D2: la vigencia de un esquema de comisión se mostraba con el día UTC y se guardaba como medianoche del
// NAVEGADOR. Después de las 18:00 en México el día UTC ya es mañana: «Vigente desde» saltaba al día siguiente y lo vendido esa
// noche no generaba comisión. La base guarda UTC; el día se lee y se escribe SIEMPRE en la zona del negocio.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { diaEnLaSede, fechaEnLaSede, finDelDiaEnLaSede, hoyEnLaSede, inicioDelDiaEnLaSede } from '../fechasDeVigencia'

const MX = 'America/Mexico_City'
// 8-oct-2026 a las 18:30 en México = 9-oct 00:30 UTC.
const NOCHE_EN_MEXICO = new Date('2026-10-09T00:30:00.000Z')
const zonaOriginal = process.env.TZ

afterEach(() => {
  process.env.TZ = zonaOriginal
  vi.useRealTimers()
})

describe.each(['UTC', 'Europe/Madrid', 'Asia/Tokyo'])('con el navegador en %s y el negocio en México', zonaDelNavegador => {
  it('«hoy» es el día del negocio, no el del navegador ni el UTC', () => {
    process.env.TZ = zonaDelNavegador
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOCHE_EN_MEXICO)
    expect(hoyEnLaSede(MX)).toBe('2026-10-08')
  })

  it('un esquema creado a las 18:32 de México se lee como del 8 de octubre', () => {
    process.env.TZ = zonaDelNavegador
    expect(diaEnLaSede('2026-10-09T00:32:00.000Z', MX)).toBe('2026-10-08')
  })

  it('«vigente desde» un día guarda la medianoche de ese día en México (06:00 UTC)', () => {
    process.env.TZ = zonaDelNavegador
    expect(inicioDelDiaEnLaSede('2026-10-08', MX)).toBe('2026-10-08T06:00:00.000Z')
  })

  it('«vigente hasta» un día incluye el día entero en México (el servidor compara con >=)', () => {
    process.env.TZ = zonaDelNavegador
    expect(finDelDiaEnLaSede('2026-10-31', MX)).toBe('2026-11-01T05:59:59.999Z')
  })

  it('leer lo guardado devuelve el mismo día que se eligió', () => {
    process.env.TZ = zonaDelNavegador
    expect(diaEnLaSede(inicioDelDiaEnLaSede('2026-10-08', MX), MX)).toBe('2026-10-08')
    expect(diaEnLaSede(finDelDiaEnLaSede('2026-10-31', MX), MX)).toBe('2026-10-31')
  })

  it('el día que se muestra en la ficha es el del negocio', () => {
    process.env.TZ = zonaDelNavegador
    expect(fechaEnLaSede('2026-10-09T00:32:00.000Z', MX, 'es')).toBe('8 oct 2026')
    expect(fechaEnLaSede('2026-10-09T00:32:00.000Z', MX, 'es', 'largo')).toBe('8 de octubre de 2026')
  })
})

describe('la zona es la del negocio, no una fija', () => {
  it('un negocio en Tijuana (UTC-7 en octubre) guarda su propia medianoche', () => {
    expect(inicioDelDiaEnLaSede('2026-10-08', 'America/Tijuana')).toBe('2026-10-08T07:00:00.000Z')
  })

  it('sin zona válida usa la de México, nunca la del navegador', () => {
    process.env.TZ = 'Asia/Tokyo'
    expect(inicioDelDiaEnLaSede('2026-10-08', 'no/existe')).toBe('2026-10-08T06:00:00.000Z')
    expect(inicioDelDiaEnLaSede('2026-10-08', '')).toBe('2026-10-08T06:00:00.000Z')
  })

  it('sin fecha o con una inválida no inventa un día', () => {
    expect(diaEnLaSede(null, MX)).toBeNull()
    expect(diaEnLaSede('no-es-fecha', MX)).toBeNull()
    expect(fechaEnLaSede(undefined, MX, 'es')).toBe('-')
  })
})
