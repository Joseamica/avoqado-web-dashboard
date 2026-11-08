/**
 * Aparatos claros, Paso 1: el Ruteo de La Galeterie. Cremería sólo saca vale: su categoría dice «Sólo vale · sin comanda» en vez
 * del selector, no cuenta como sin ruta y no dispara «Sin estación por defecto».
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { RoutingTab } from '../RoutingTab'

const h = vi.hoisted(() => ({ get: vi.fn(), permisos: ['area-tickets:configure'] as string[] }))
vi.mock('@/services/printStations.service', async original => ({
  ...(await original<typeof import('@/services/printStations.service')>()),
  getRouting: (...args: unknown[]) => h.get(...args),
  getPrintStations: () => Promise.resolve([{ id: 's1', name: 'Cocina', active: true }]),
}))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (k: string) => k }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/galeterie' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => h.permisos.includes(p) }) }))

const CATEGORIAS = [
  { id: 'c_alim', name: 'ALIMENTOS', printStationId: 's1', productCount: 32 },
  { id: 'c_cre', name: 'CREMERÍA', printStationId: null, productCount: 213, areaTicketOnly: true },
  { id: 'c_fra', name: 'FRANCESERO', printStationId: null, productCount: 45, areaTicketOnly: true },
]
const respuesta = (extra: Record<string, unknown>) => ({
  categories: CATEGORIAS,
  products: [],
  hasDefault: false,
  unroutedCategories: 2,
  pagination: { page: 1, pageSize: 50, total: 3, totalPages: 1 },
  ...extra,
})

beforeAll(async () => {
  await i18n.changeLanguage('es')
})
beforeEach(() => {
  h.permisos = ['area-tickets:configure']
  h.get.mockReset().mockResolvedValue(
    respuesta({ areaTicketOnlyUnrouted: 2, areasWithoutComanda: [{ id: 'a1', name: 'Cremería' }, { id: 'a2', name: 'Panadería' }] }),
  )
})
function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <RoutingTab venueId="v1" />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('Ruteo con «Sólo vale»', () => {
  it('las de Cremería y Panadería dicen «Sólo vale · sin comanda», 0 sin ruta y sin el aviso amarillo; la nota enlaza a Vales', async () => {
    mount()
    const cremeria = await screen.findByTestId('routing-category-c_cre')
    expect(within(cremeria).getByText('Sólo vale · sin comanda')).toBeInTheDocument()
    expect(within(cremeria).queryByRole('combobox')).toBeNull()
    expect(within(screen.getByTestId('routing-category-c_alim')).getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('0 categorías sin ruta')).toBeInTheDocument()
    expect(screen.queryByText('Sin estación por defecto')).toBeNull()
    expect(screen.getByText(/Cremería y Panadería sólo sacan vale/)).toBeInTheDocument()
    expect(screen.getByText(/se cobra sin vale .*estación del producto o de su categoría; si ninguna tiene, sale marcada SIN ESTACIÓN/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cambiar en Vales por área' })).toHaveAttribute('href', '/venues/galeterie/settings/area-tickets#areas')
  })

  it('si quedan otras sin ruta, cuentan ésas y el aviso sigue', async () => {
    h.get.mockResolvedValue(respuesta({ unroutedCategories: 3, areaTicketOnlyUnrouted: 2, areasWithoutComanda: [{ id: 'a1', name: 'Cremería' }] }))
    mount()
    expect(await screen.findByText('1 categoría sin ruta')).toBeInTheDocument()
    expect(screen.getByText('Sin estación por defecto')).toBeInTheDocument()
  })

  it('sin permiso de Vales por área, la nota sale sin la liga', async () => {
    h.permisos = []
    mount()
    expect(await screen.findByText(/sólo sacan vale/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cambiar en Vales por área' })).toBeNull()
  })

  it('un SERVIDOR viejo (sin los campos nuevos) se ve como hoy: selector y aviso', async () => {
    h.get.mockResolvedValue({
      ...respuesta({}),
      categories: CATEGORIAS.map(({ areaTicketOnly: _a, ...c }) => c),
    })
    mount()
    const cremeria = await screen.findByTestId('routing-category-c_cre')
    expect(within(cremeria).getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('2 categorías sin ruta')).toBeInTheDocument()
    expect(screen.getByText('Sin estación por defecto')).toBeInTheDocument()
    expect(screen.queryByText(/sólo sacan vale/)).toBeNull()
  })

  it('con una sola área la nota va en singular', async () => {
    h.get.mockResolvedValue(respuesta({ areaTicketOnlyUnrouted: 2, areasWithoutComanda: [{ id: 'a2', name: 'Panadería' }] }))
    mount()
    expect(await screen.findByText(/^Panadería sólo saca vale \(sin comanda\)/)).toBeInTheDocument()
  })

  it('Codex r2 #4: con estación por defecto no se dice que saldría SIN ESTACIÓN (iría a la de por defecto)', async () => {
    h.get.mockResolvedValue(
      respuesta({ hasDefault: true, unroutedCategories: 0, areaTicketOnlyUnrouted: 0, areasWithoutComanda: [{ id: 'a1', name: 'Cremería' }] }),
    )
    mount()
    expect(await screen.findByText(/Cremería sólo saca vale/)).toBeInTheDocument()
    expect(screen.queryByText(/sale marcada SIN ESTACIÓN/)).toBeNull()
  })
})
