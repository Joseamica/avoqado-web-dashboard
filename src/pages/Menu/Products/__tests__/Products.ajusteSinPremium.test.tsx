/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026): un producto puede contar piezas en Gratis/Pro (se da de alta así), pero «Ajustar
 * existencias» de un producto que ya existe sigue siendo Premium (INVENTORY_TRACKING). Lo decide el SERVIDOR al confirmar, en vivo: un
 * candado en la lista con una respuesta guardada se equivocaba al cambiar de plan o de sesión (Codex r4 #4 y #5). Su rechazo de plan
 * viene en inglés y aquí se dice en español: no se cambió nada.
 * Arnés de `Products.filasPorId.test.tsx`; `t` estable; vitest con mockReset.
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
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
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
const ajuste = vi.hoisted(() => ({ props: [] as Array<{ open: boolean; onConfirm: (a: number, r: string, n?: string) => void }> }))
vi.mock('@/components/AdjustStockDialog', () => ({
  AdjustStockDialog: (p: { open: boolean; onConfirm: (a: number, r: string, n?: string) => void }) => {
    ajuste.props.push({ open: p.open, onConfirm: p.onConfirm })
    return null
  },
}))
vi.mock('@/pages/Inventory/components/ProductTypeSelectorModal', () => ({ ProductTypeSelectorModal: () => null }))
vi.mock('@/pages/Menu/Services/ConvertToServiceDialog', () => ({ ConvertToServiceDialog: () => null }))
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('../components/ProductGroupDialog', () => ({ ProductGroupDialog: () => null }))
vi.mock('../components/SuggestionsBanner', () => ({ SuggestionsBanner: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
const ajustar = vi.hoisted(() => ({ adjustStock: vi.fn() }))
vi.mock('@/services/inventory.service', async importOriginal => ({
  ...(await importOriginal<object>()),
  productInventoryApi: { adjustStock: ajustar.adjustStock },
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/venues/mi-tienda/menumaker/products']}>
        <Products />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function abrirAjusteDe(nombre: string) {
  const user = userEvent.setup()
  pintar()
  await screen.findByText(nombre)
  await user.click(within(screen.getByText(nombre).closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
  await user.click(await screen.findByRole('menuitem', { name: /products\.actions\.adjustStock/ }))
  await waitFor(() => expect(ajuste.props.some(p => p.open)).toBe(true))
  return ajuste.props[ajuste.props.length - 1]
}

const rechazo = (status: number, data: object) => Object.assign(new Error('rechazo'), { response: { status, data } })

beforeEach(() => {
  ajustar.adjustStock.mockResolvedValue({ data: { message: 'ok' } })
  avisos.toast.mockReset()
  ajuste.props = []
  menu.getProducts.mockResolvedValue([conPiezas('a', 'Libreta')])
})

describe('Products — «Ajustar existencias» sin Premium (na1d52b5)', { timeout: 20_000 }, () => {
  // NEW FEATURE TESTS
  it('el SERVIDOR rechaza el ajuste por plan: el aviso lo dice en español (no el inglés del SERVIDOR) y que no cambió nada', async () => {
    ajustar.adjustStock.mockRejectedValue(
      rechazo(403, {
        error: 'Feature not available',
        message: 'This venue does not have access to the INVENTORY_TRACKING feature.',
        featureCode: 'INVENTORY_TRACKING',
        subscriptionRequired: true,
      }),
    )
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    expect(avisos.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'products.toasts.adjustStockPremiumTitle',
        description: 'products.toasts.adjustStockPremium',
        variant: 'destructive',
      }),
    )
  })

  it('prueba vencida o suscripción suspendida: se muestra el motivo del SERVIDOR (cómo recuperarlo), no «es Premium» (Codex r9 #5)', async () => {
    ajustar.adjustStock.mockRejectedValue(
      rechazo(403, {
        error: 'Feature trial expired',
        message: 'Your trial for Inventario has expired. Please add a payment method to continue using this feature.',
        featureCode: 'INVENTORY_TRACKING',
        trialExpired: true,
      }),
    )
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    expect(avisos.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'error', description: expect.stringContaining('trial') }),
    )
  })

  // REGRESSION TESTS
  it('la opción se ve y abre el ajuste como siempre: no hay candado con una respuesta guardada (Codex r4 #4)', async () => {
    const dialogo = await abrirAjusteDe('Libreta')
    expect(dialogo.open).toBe(true)
  })

  it('otro rechazo (p. ej. sin permiso) sigue mostrando el mensaje del SERVIDOR', async () => {
    ajustar.adjustStock.mockRejectedValue(rechazo(403, { message: 'No tienes permiso para ajustar existencias' }))
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    expect(avisos.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'error', description: 'No tienes permiso para ajustar existencias', variant: 'destructive' }),
    )
  })

  it('un ajuste que sí pasa se manda con su cantidad y avisa que se guardó', async () => {
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT', 'conteo')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledWith('v1', 'a', expect.objectContaining({ quantity: 5 })))
    await waitFor(() => expect(avisos.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'products.toasts.saved' })))
  })
})
