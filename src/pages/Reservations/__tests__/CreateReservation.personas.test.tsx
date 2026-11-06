/**
 * D27: «Crear cita» proponía 2 personas para un servicio de una persona (un corte de cabello).
 * El 2 viene de las mesas de restaurante: sólo una reserva de MESA (negocio con mesas y sin servicio elegido) propone 2;
 * una cita de servicio propone 1. Lo que la persona escribe a mano no se pisa.
 * La pantalla y TanStack son de verdad; sólo se finge la red (`@/api`) y quién mira (arnés de parte3C.test.tsx).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const red = vi.hoisted(() => {
  const venue = {
    id: 'v1',
    name: 'Mi negocio',
    slug: 'mi-negocio',
    type: 'BEAUTY_SALON',
    organizationId: 'o1',
    role: 'OWNER',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    modules: [],
    features: [],
  }
  return {
    venue,
    rutas: [
      [
        /venues\/v1\/products/,
        [{ id: 'p1', name: 'Corte de cabello', active: true, type: 'APPOINTMENTS_SERVICE', duration: 30, price: '250.00' }],
      ],
      [/reservations\/settings/, { scheduling: { capacityMode: 'pacing' }, publicBooking: { showStaffPicker: false } }],
    ] as Array<[RegExp, unknown]>,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string) => {
    const ruta = red.rutas.find(([patron]) => patron.test(url))
    return { data: ruta ? ruta[1] : { success: true, data: [], total: 0, meta: { currentPage: 1, totalPages: 1 }, slots: [] } }
  }
  const cliente = {
    get: responder,
    post: responder,
    put: responder,
    patch: responder,
    delete: responder,
    interceptors: { request: { use() {} }, response: { use() {} } },
  }
  return {
    default: cliente,
    publicApi: cliente,
    getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }),
    subscribeToConnection: () => () => {},
  }
})
vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 'u1', role: 'OWNER', venues: [red.venue] },
    staffInfo: { id: 'u1', role: 'OWNER' },
    isAuthenticated: true,
    isLoading: false,
    activeVenue: red.venue,
    allVenues: [red.venue],
    checkFeatureAccess: () => true,
    checkModuleAccess: () => true,
    getVenueBySlug: () => red.venue,
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'mi-negocio',
    venue: red.venue,
    fullBasePath: '/venues/mi-negocio',
    isLoading: false,
  }),
}))
vi.mock('@/hooks/use-access', async original => ({
  ...(await original<typeof import('@/hooks/use-access')>()),
  useAccess: () => ({
    role: 'OWNER',
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    getDataScope: () => 'venue',
    isLoading: false,
  }),
}))
vi.mock('@/hooks/use-tier-feature-access', async original => ({
  ...(await original<typeof import('@/hooks/use-tier-feature-access')>()),
  useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false, requiredTier: null }),
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false }),
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))

import { CreateReservationForm } from '../CreateReservation'

Element.prototype.scrollIntoView = () => {}

function pintar(tipoDeNegocio: string) {
  red.venue.type = tipoDeNegocio
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CreateReservationForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const personas = () => screen.getByRole('spinbutton') as HTMLInputElement
const elegirServicio = async () => {
  fireEvent.click(await screen.findByPlaceholderText('Buscar servicio por nombre...'))
  fireEvent.click(await screen.findByRole('option', { name: /Corte de cabello/ }))
  await screen.findByRole('button', { name: 'Cambiar' })
}

afterEach(() => cleanup())

describe('Crear cita: cuántas personas propone (D27)', () => {
  it('una estética propone 1 persona', async () => {
    pintar('BEAUTY_SALON')
    await waitFor(() => expect(personas().value).toBe('1'))
  })

  it('una estética con el corte elegido sigue en 1', async () => {
    pintar('BEAUTY_SALON')
    await elegirServicio()
    expect(personas().value).toBe('1')
  })

  it('un restaurante sin servicio (reserva de mesa) sigue proponiendo 2', async () => {
    pintar('RESTAURANT')
    await waitFor(() => expect(personas().value).toBe('2'))
  })

  it('un restaurante que agenda un servicio (el corte del video) propone 1', async () => {
    pintar('RESTAURANT')
    await elegirServicio()
    await waitFor(() => expect(personas().value).toBe('1'))
  })

  it('si la persona ya escribió cuántas son, elegir el servicio no se lo pisa', async () => {
    pintar('RESTAURANT')
    fireEvent.change(personas(), { target: { value: '4' } })
    await elegirServicio()
    expect(personas().value).toBe('4')
  })
})
