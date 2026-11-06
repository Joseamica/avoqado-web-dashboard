/**
 * D29: la página pública de reservas proponía 2 personas aunque la clienta reservara un servicio de una (un corte de
 * cabello). Misma regla que «Crear cita» del panel (D27): sólo una reserva de MESA (negocio con mesas y sin servicio)
 * propone 2; un servicio, una clase o un evento proponen 1.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuestInfoForm } from '../GuestInfoForm'
import type { PublicVenueInfo } from '@/services/publicBooking.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const negocio = (type: string): PublicVenueInfo => ({
  name: 'Mi negocio',
  slug: 'mi-negocio',
  logo: null,
  type,
  address: null,
  phone: null,
  timezone: 'America/Mexico_City',
  products: [],
  publicBooking: { enabled: true, requirePhone: true, requireEmail: false },
})

const personas = (type: string, hasService: boolean) => {
  render(<GuestInfoForm venueInfo={negocio(type)} hasService={hasService} onSubmit={() => {}} isSubmitting={false} />)
  return (screen.getByLabelText('publicBooking.guestForm.partySize') as HTMLInputElement).value
}

describe('GuestInfoForm · Personas sugeridas (D29)', () => {
  it('una estética que reserva un servicio propone 1', () => {
    expect(personas('BEAUTY_SALON', true)).toBe('1')
  })

  it('un restaurante que reserva un servicio (no una mesa) propone 1', () => {
    expect(personas('RESTAURANT', true)).toBe('1')
  })

  it('un restaurante sin servicio (reserva de mesa) sigue proponiendo 2', () => {
    expect(personas('RESTAURANT', false)).toBe('2')
  })

  it('un negocio sin mesas y sin servicio propone 1', () => {
    expect(personas('GYM', false)).toBe('1')
  })
})
