// D1 (28-oct): el selector de fechas corría el rango un día cuando la computadora estaba en otra zona que el negocio.
// El calendario entrega la medianoche del NAVEGADOR y el final se reinterpretaba en la zona del negocio: en Madrid,
// elegir «1–8 oct» para un negocio en México mandaba hasta el 7-oct 23:59 y el 8 se perdía.
import { afterEach, describe, expect, it } from 'vitest'
import { diaAnteriorDelNegocio, diaDelNegocio, instantesDelNegocio, mismoRango } from '../fechasDelSelector'

const MX = 'America/Mexico_City'
const zonaOriginal = process.env.TZ

afterEach(() => {
  process.env.TZ = zonaOriginal
})

describe.each(['Europe/Madrid', 'Asia/Tokyo', 'America/Los_Angeles', 'America/Mexico_City'])(
  'con la computadora en %s y el negocio en México',
  zonaDelNavegador => {
    it('los días elegidos se mandan enteros en la hora del negocio', () => {
      process.env.TZ = zonaDelNavegador
      const r = instantesDelNegocio({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 8) }, MX)
      expect(r.from.toISOString()).toBe('2026-10-01T06:00:00.000Z')
      expect(r.to.toISOString()).toBe('2026-10-09T05:59:59.999Z')
    })

    it('un solo día elegido es ese día entero, no un rango vacío', () => {
      process.env.TZ = zonaDelNavegador
      const r = instantesDelNegocio({ from: new Date(2026, 9, 8), to: undefined }, MX)
      expect(r.from.toISOString()).toBe('2026-10-08T06:00:00.000Z')
      expect(r.to.toISOString()).toBe('2026-10-09T05:59:59.999Z')
    })

    it('el calendario pinta el día del negocio de lo que manda la pantalla', () => {
      process.env.TZ = zonaDelNavegador
      // 7-oct 23:59:59.999 en México (fin de día) y 1-oct 00:00 en México (inicio de día).
      const fin = diaDelNegocio(new Date('2026-10-08T05:59:59.999Z'), MX)
      const inicio = diaDelNegocio(new Date('2026-10-01T06:00:00.000Z'), MX)
      expect([fin.getFullYear(), fin.getMonth() + 1, fin.getDate()]).toEqual([2026, 10, 7])
      expect([inicio.getFullYear(), inicio.getMonth() + 1, inicio.getDate()]).toEqual([2026, 10, 1])
    })

    it('ida y vuelta: lo que pinta y lo que manda son el mismo día', () => {
      process.env.TZ = zonaDelNavegador
      const r = instantesDelNegocio({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 1) }, MX) // cambio de horario en EE. UU.
      const dia = diaDelNegocio(r.to, MX)
      expect([dia.getMonth() + 1, dia.getDate()]).toEqual([11, 1])
      expect(r.from.toISOString()).toBe('2026-11-01T06:00:00.000Z')
    })
  },
)

describe('mismoRango (lo que decide si «Aplicar» avisa a la pantalla)', () => {
  const uno = new Date(2026, 9, 1)
  const siete = new Date(2026, 9, 7)
  it('«1–7 oct» y «sólo el 1» son rangos distintos', () => {
    expect(mismoRango({ from: uno, to: siete }, { from: uno, to: undefined })).toBe(false)
  })
  it('los mismos días son el mismo rango, aunque sean otros objetos', () => {
    expect(mismoRango({ from: uno, to: siete }, { from: new Date(2026, 9, 1), to: new Date(2026, 9, 7) })).toBe(true)
  })
  it('sin comparar (ninguno) es igual; sólo uno no', () => {
    expect(mismoRango(undefined, undefined)).toBe(true)
    expect(mismoRango({ from: uno }, undefined)).toBe(false)
  })
})

describe.each(['Europe/Madrid', 'America/Los_Angeles', 'America/Mexico_City'])('«vs día anterior» con la computadora en %s', zona => {
  it('es el día entero anterior en México, también al cruzar el cambio de horario', () => {
    process.env.TZ = zona
    // 25-oct (Madrid ya cambió de horario esa madrugada) y 2-nov (Los Ángeles cambió el 1).
    expect(diaAnteriorDelNegocio(new Date('2026-10-25T06:00:00.000Z'), MX)).toEqual({
      start: '2026-10-24T06:00:00.000Z',
      end: '2026-10-25T05:59:59.999Z',
    })
    expect(diaAnteriorDelNegocio(new Date('2026-11-02T06:00:00.000Z'), MX)).toEqual({
      start: '2026-11-01T06:00:00.000Z',
      end: '2026-11-02T05:59:59.999Z',
    })
  })
})
