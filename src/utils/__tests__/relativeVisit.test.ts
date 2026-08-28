/**
 * «Hace cuánto vino» se cuenta en DÍAS CIVILES de la zona del NEGOCIO.
 *
 * 🔴 Los bugs que originaron estas pruebas (vistos capturando la guía de clientes, 27-ago-2026):
 *  1. La lista decía «1 semanas atrás» — la clave era siempre plural.
 *  2. Contaba con `new Date()` del NAVEGADOR. Regla dura del repo: nunca el reloj del navegador.
 *     Con el cajero en otra zona, una visita de ayer 9pm podía leerse «Hoy» y al revés.
 *  3. Restaba milisegundos y dividía entre 86 400 000, así que «ayer a las 11pm» y «hoy a la 1am»
 *     salían como 0 días — el mismo día, cuando el negocio ya cambió de jornada.
 */
import { describe, it, expect } from 'vitest'
import { diasCivilesDesde } from '@/utils/relativeVisit'

const TZ = 'America/Mexico_City'

describe('días civiles desde la última visita', () => {
  it('la misma jornada es 0', () => {
    expect(diasCivilesDesde('2026-08-27T15:00:00Z', TZ, new Date('2026-08-27T22:00:00Z'))).toBe(0)
  })

  it('🔴 ayer a las 11pm es AYER, aunque no hayan pasado 24 horas', () => {
    // 2026-08-27 23:00 en México = 2026-08-28T05:00Z · «ahora» = 2026-08-28 01:00 México
    expect(diasCivilesDesde('2026-08-28T05:00:00Z', TZ, new Date('2026-08-28T07:00:00Z'))).toBe(1)
  })

  it('cuenta jornadas completas, no bloques de 24 horas', () => {
    // 20-ago 12:00 México → «ahora» 26-ago 19:00 México (01:00Z del 27) = 6 jornadas.
    // Restando milisegundos darían 6.29 → 6 también, pero por la razón equivocada.
    expect(diasCivilesDesde('2026-08-20T18:00:00Z', TZ, new Date('2026-08-27T01:00:00Z'))).toBe(6)
  })

  it('la zona del negocio manda: el mismo instante da distinto en México y en Madrid', () => {
    const visita = '2026-08-28T04:00:00Z' // 27-ago 22:00 en México · 28-ago 06:00 en Madrid
    const ahora = new Date('2026-08-28T10:00:00Z')
    expect(diasCivilesDesde(visita, TZ, ahora)).toBe(1)
    expect(diasCivilesDesde(visita, 'Europe/Madrid', ahora)).toBe(0)
  })

  it('una fecha inválida o vacía devuelve null en vez de un número inventado', () => {
    expect(diasCivilesDesde('', TZ)).toBeNull()
    expect(diasCivilesDesde('no-es-fecha', TZ)).toBeNull()
  })

  it('una visita en el futuro no produce días negativos', () => {
    expect(diasCivilesDesde('2026-08-30T15:00:00Z', TZ, new Date('2026-08-27T15:00:00Z'))).toBe(0)
  })
})
