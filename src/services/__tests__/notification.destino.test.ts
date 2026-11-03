import { describe, expect, it } from 'vitest'
import { destinoDelAviso } from '@/services/notification.service'

// Codex (apps viejas, 29-oct): un dueño con varias sucursales recibe avisos de todas; la liga
// relativa («reservations/<id>») se armaba con la sucursal ABIERTA y no encontraba la reserva.
const enB = { venueBasePath: '/venues', fullBasePath: '/venues/sucursal-b', venueSlug: 'sucursal-b' }
const slugs: Record<string, string> = { 'venue-a': 'sucursal-a', 'venue-b': 'sucursal-b' }
const slugDeId = (id: string) => slugs[id] ?? null

describe('destinoDelAviso', () => {
  it('abre la sucursal del aviso aunque esté abierta otra', () => {
    expect(destinoDelAviso('reservations/r1', { venue: { slug: 'sucursal-a' } }, enB, slugDeId)).toBe(
      '/venues/sucursal-a/reservations/r1',
    )
  })

  it('el aviso que llega por socket trae sólo venueId: lo traduce con las sucursales del usuario', () => {
    expect(destinoDelAviso('reservations/r1', { venueId: 'venue-a' }, enB, slugDeId)).toBe('/venues/sucursal-a/reservations/r1')
  })

  it('respeta el modo de marca blanca', () => {
    const wl = { venueBasePath: '/wl/venues', fullBasePath: '/wl/venues/sucursal-b', venueSlug: 'sucursal-b' }
    expect(destinoDelAviso('reservations', { venue: { slug: 'sucursal-a' } }, wl, slugDeId)).toBe('/wl/venues/sucursal-a/reservations')
  })

  it('sin sucursal abierta (vista de organización) usa la del aviso', () => {
    const org = { venueBasePath: '/venues', fullBasePath: '/venues', venueSlug: null }
    expect(destinoDelAviso('reservations/r1', { venueId: 'venue-a' }, org, slugDeId)).toBe('/venues/sucursal-a/reservations/r1')
  })

  it('sin saber la sucursal del aviso, se queda como antes: la abierta', () => {
    expect(destinoDelAviso('orders', { venueId: 'otra' }, enB, slugDeId)).toBe('/venues/sucursal-b/orders')
    expect(destinoDelAviso('orders', {}, { venueBasePath: '/venues', fullBasePath: '/venues', venueSlug: null }, slugDeId)).toBe(
      '/orders',
    )
  })

  it('las ligas absolutas no se tocan', () => {
    expect(destinoDelAviso('/superadmin/kyc/v1', { venue: { slug: 'sucursal-a' } }, enB, slugDeId)).toBe('/superadmin/kyc/v1')
    expect(destinoDelAviso('https://help.avoqado.io/x', { venueId: 'venue-a' }, enB, slugDeId)).toBe('https://help.avoqado.io/x')
  })
})
