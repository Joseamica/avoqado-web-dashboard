/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026): un producto puede contar piezas en Gratis/Pro (se da de alta así), pero «Ajustar
 * existencias» de la lista llama a una ruta Premium (INVENTORY_TRACKING). Sin Premium se ve con su candado y no abre nada que terminaría
 * en error (Codex r1 #7). Arnés de `Products.filasPorId.test.tsx`; `t` estable; vitest con mockReset.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
const ajuste = vi.hoisted(() => ({ props: [] as Array<{ open: boolean }> }))
vi.mock('@/components/AdjustStockDialog', () => ({
  AdjustStockDialog: (p: { open: boolean }) => {
    ajuste.props.push({ open: p.open })
    return null
  },
}))
vi.mock('@/pages/Inventory/components/ProductTypeSelectorModal', () => ({ ProductTypeSelectorModal: () => null }))
vi.mock('@/pages/Menu/Services/ConvertToServiceDialog', () => ({ ConvertToServiceDialog: () => null }))
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('../components/ProductGroupDialog', () => ({ ProductGroupDialog: () => null }))
vi.mock('../components/SuggestionsBanner', () => ({ SuggestionsBanner: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
const plan = vi.hoisted(() => ({ inventario: false, resuelto: true }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({
    hasAccess: plan.inventario,
    isResolved: plan.resuelto,
    isLoading: !plan.resuelto,
    requiredTier: 'PREMIUM',
  }),
}))

import Products from '../Products'

const conPiezas = (id: string, name: string) => ({
  id,
  name,
  price: 20,
  type: 'REGULAR',
  active: true,
  imageUrl: null,
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
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
}

async function abrirMenuDe(nombre: string) {
  const user = userEvent.setup()
  pintar()
  await screen.findByText(nombre)
  await user.click(within(screen.getByText(nombre).closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
  return { user, opcion: await screen.findByRole('menuitem', { name: /products\.actions\.adjustStock/ }) }
}

beforeEach(() => {
  plan.inventario = false
  plan.resuelto = true
  ajuste.props = []
  menu.getProducts.mockResolvedValue([conPiezas('a', 'Libreta')])
})

describe('Products — «Ajustar existencias» sin Premium (na1d52b5)', () => {
  // NEW FEATURE TESTS
  it('Gratis/Pro: la opción se ve, con la etiqueta del plan, y no abre el ajuste', async () => {
    const { user, opcion } = await abrirMenuDe('Libreta')
    expect(opcion).toHaveTextContent('products.actions.adjustStockPremium')
    expect(opcion).toHaveAttribute('aria-disabled', 'true')
    await user.click(opcion)
    expect(ajuste.props.some(p => p.open)).toBe(false)
  })

  // REGRESSION TESTS
  it('Premium: la opción abre el ajuste como siempre', async () => {
    plan.inventario = true
    const { user, opcion } = await abrirMenuDe('Libreta')
    expect(opcion).not.toHaveTextContent('products.actions.adjustStockPremium')
    await user.click(opcion)
    await waitFor(() => expect(ajuste.props.some(p => p.open)).toBe(true))
  })

  it('si el plan llega DESPUÉS de pintar la lista, el candado aparece igual (las columnas se recalculan)', async () => {
    plan.resuelto = false
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const arbol = () => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/venues/mi-tienda/menumaker/products']}>
          <Products />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const { rerender } = render(arbol())
    await screen.findByText('Libreta')
    plan.resuelto = true
    rerender(arbol()) // mismo árbol: Products se vuelve a pintar sin remontarse
    await user.click(within(screen.getByText('Libreta').closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
    expect(await screen.findByRole('menuitem', { name: /products\.actions\.adjustStock/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('mientras el plan no se sabe, no se pone el candado (el SERVIDOR decide, como en el resto del panel)', async () => {
    plan.resuelto = false
    const { opcion } = await abrirMenuDe('Libreta')
    expect(opcion).not.toHaveAttribute('aria-disabled', 'true')
  })
})
