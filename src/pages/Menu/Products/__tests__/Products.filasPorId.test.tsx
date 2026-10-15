/**
 * Variantes de producto, bloque 2 (Tarea 15, ronda 1): las filas de la lista de Productos se identifican por id, no por posición.
 * Con las columnas estables (Tarea 9), React reusaría por índice un menú «…» abierto: un refetch que quita una fila de arriba
 * dejaba el menú de B mostrando las acciones de C. Arnés de `Products.variants.test.tsx`; `t` estable; vitest con mockReset.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const menu = vi.hoisted(() => ({ getProducts: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn() }))
const estables = vi.hoisted(() => {
  const t = (k: string, o?: unknown) =>
    [k, ...(o && typeof o === 'object' ? Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)])) : [])].join(':')
  return { setHeader: () => {}, start: () => {}, i18n: { t, i18n: { language: 'es' } } }
})

vi.mock('@/services/menu.service', async importOriginal => ({ ...(await importOriginal<object>()), ...menu }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
vi.mock('@/hooks/use-menu-socket-events', () => ({ useMenuSocketEvents: () => {} }))
vi.mock('@/hooks/useProductCreationTour', () => ({ useProductCreationTour: () => ({ start: estables.start }) }))
vi.mock('@/hooks/useRecipeCreationTour', () => ({ useRecipeCreationTour: () => ({ start: estables.start }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ checkFeatureAccess: () => false }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (s: string) => s }) }))
vi.mock('../../MenuMakerLayout', () => ({ useMenuMakerHeader: () => ({ setHeader: estables.setHeader }) }))
vi.mock('@/components/onboarding/TourDiscoveryBanner', () => ({ TourDiscoveryBanner: () => null }))
vi.mock('@/pages/Menu/Products/components/AvisoAparatosIva', () => ({ AvisoAparatosIva: () => null }))
vi.mock('@/components/inventory/InventoryDetailsModal', () => ({ InventoryDetailsModal: () => null }))
vi.mock('@/components/AdjustStockDialog', () => ({ AdjustStockDialog: () => null }))
vi.mock('@/pages/Inventory/components/ProductTypeSelectorModal', () => ({ ProductTypeSelectorModal: () => null }))
vi.mock('@/pages/Menu/Services/ConvertToServiceDialog', () => ({ ConvertToServiceDialog: () => null }))
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('../components/ProductGroupDialog', () => ({ ProductGroupDialog: () => null }))
vi.mock('../components/SuggestionsBanner', () => ({ SuggestionsBanner: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import Products from '../Products'

const producto = (id: string, name: string) => ({
  id,
  name,
  price: 20,
  type: 'REGULAR',
  active: true,
  imageUrl: null,
  trackInventory: false,
  modifierGroups: [],
  updatedAt: '2026-10-01',
})

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/venues/mi-tienda/menumaker/products']}>
        <Products />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}

beforeEach(() => {
  menu.getProducts.mockResolvedValue([producto('a', 'Aceite'), producto('b', 'Botella'), producto('c', 'Cera')])
  menu.deleteProduct.mockResolvedValue({})
})

describe('Products — cada fila es SU producto aunque la lista se reacomode', () => {
  it('🔴 con el menú «…» de Botella abierto, un refetch sin Aceite no hace que «Eliminar» actúe sobre Cera', async () => {
    const user = userEvent.setup()
    const qc = pintar()
    await screen.findByText('Botella')
    await user.click(within(screen.getByText('Botella').closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
    await screen.findByRole('menuitem', { name: 'delete' })

    menu.getProducts.mockResolvedValue([producto('b', 'Botella'), producto('c', 'Cera')])
    await act(async () => {
      await qc.refetchQueries()
    })
    await waitFor(() => expect(screen.queryByText('Aceite')).not.toBeInTheDocument())

    await user.click(screen.getByRole('menuitem', { name: 'delete' }))
    await user.click(await screen.findByRole('button', { name: 'products.detail.deleteConfirm' }))
    await waitFor(() => expect(menu.deleteProduct).toHaveBeenCalledTimes(1))
    expect(menu.deleteProduct).toHaveBeenCalledWith('v1', 'b')
  })
})
