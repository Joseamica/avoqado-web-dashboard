import { describe, it, expect } from 'vitest'

import { avisoPorOmision, CANALES_DE_AVISO, horaDelNegocioAUtc } from '../reagendar'

// Encargo e781ce: «Reagendar» mandaba la hora del `<input type="datetime-local">` sin zona y el
// SERVIDOR la leía en UTC: la cita quedaba 6 h antes en México.
describe('horaDelNegocioAUtc', () => {
  it('15:00 de un negocio en CDMX es 21:00 UTC', () => {
    expect(horaDelNegocioAUtc('2026-11-12T15:00', 'America/Mexico_City')).toBe('2026-11-12T21:00:00.000Z')
  })

  it('usa la zona del negocio, no la del navegador (Cancún = UTC-5)', () => {
    expect(horaDelNegocioAUtc('2026-11-12T15:00', 'America/Cancun')).toBe('2026-11-12T20:00:00.000Z')
  })

  it('vacío o inválido devuelve null', () => {
    expect(horaDelNegocioAUtc('', 'America/Mexico_City')).toBeNull()
    expect(horaDelNegocioAUtc('no-es-fecha', 'America/Mexico_City')).toBeNull()
  })
})

describe('avisoPorOmision', () => {
  const base = { customer: null, guestPhone: null, guestEmail: null }

  it('con teléfono, WhatsApp', () => {
    expect(avisoPorOmision({ ...base, guestPhone: '+5215551234567', guestEmail: 'a@b.com' })).toBe('whatsapp')
    expect(avisoPorOmision({ ...base, customer: { phone: '+5215551234567', email: null } })).toBe('whatsapp')
  })

  it('sin teléfono y con correo, correo', () => {
    expect(avisoPorOmision({ ...base, guestEmail: 'a@b.com' })).toBe('email')
    expect(avisoPorOmision({ ...base, customer: { phone: null, email: 'a@b.com' } })).toBe('email')
  })

  it('sin teléfono ni correo, sin aviso', () => {
    expect(avisoPorOmision(base)).toBe('none')
  })
})

describe('CANALES_DE_AVISO', () => {
  it('ya no ofrece «push», que no le llega a nadie', () => {
    expect(CANALES_DE_AVISO).toEqual(['whatsapp', 'email', 'none'])
  })
})
