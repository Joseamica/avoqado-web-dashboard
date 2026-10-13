import { describe, expect, it, vi } from 'vitest'

import { createVenueRoutes } from '@/routes/venueRoutes'
import { pageForOtherVenue } from '@/utils/pageForOtherVenue'

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/use-access', () => ({ useAccess: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? '' }) }))

// Las rutas reales del dashboard, montadas como en router.tsx (más la página de error que atrapa todo lo demás).
const routes = [
  { path: '/venues/:slug', children: createVenueRoutes() },
  { path: '/wl/venues/:slug', children: createVenueRoutes() },
  { path: '*' },
]

describe('pageForOtherVenue: al cambiar de sucursal no se arrastra el id de la anterior', () => {
  it.each([
    ['team/cmn3ayy350022n2272jhdbgw5', 'team'], // la ficha de una persona → la lista de Personas (caso de prod, 12-oct)
    ['orders/cmabc123', 'orders'],
    ['devices/orders/cmabc123', 'devices'], // «devices/orders» sola caería en devices/:tpvId con tpvId = «orders»
    ['devices/cmabc123', 'devices'],
    ['inventory/stock-counts/cmabc123', 'inventory/stock-counts'],
    ['customers/cmabc123', 'customers'],
  ])('%s → %s', (pagePart, expected) => {
    expect(pageForOtherVenue(routes, '/venues/flautas', pagePart)).toBe(expected)
  })

  it('una página sin id se conserva tal cual', () => {
    expect(pageForOtherVenue(routes, '/venues/flautas', 'inventory/stock-counts')).toBe('inventory/stock-counts')
    expect(pageForOtherVenue(routes, '/venues/flautas', 'team')).toBe('team')
    expect(pageForOtherVenue(routes, '/wl/venues/flautas', 'team/cmabc123')).toBe('team')
  })

  it('una página que no existe en la sucursal nueva da vacío (el que llama usa la página de inicio)', () => {
    expect(pageForOtherVenue(routes, '/venues/flautas', 'no-existe/cmabc123')).toBe('')
    expect(pageForOtherVenue(routes, '/venues/flautas', '')).toBe('')
  })
})
