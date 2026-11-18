/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026): un producto puede contar piezas en Gratis/Pro (se da de alta así). Desde D2 (18-nov)
 * su ajuste simple también es de todos los planes; el rechazo de plan sólo sale con un SERVIDOR anterior a D2. Lo decide el SERVIDOR al confirmar, en vivo: un
 * candado en la lista con una respuesta guardada se equivocaba al cambiar de plan o de sesión (Codex r4 #4 y #5). Su rechazo de plan
 * viene en inglés y aquí se dice en español: no se cambió nada.
 * Arnés de `Products.filasPorId.test.tsx`; `t` estable; vitest con mockReset.
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
// D2: un permiso de `acceso.negados` no lo tiene quien usa la pantalla.
const acceso = vi.hoisted(() => ({ negados: new Set<string>() }))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (p: string) => !acceso.negados.has(p), canAny: () => true, canAll: () => true }),
}))
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
type PropsDelAjuste = { open: boolean; onConfirm: (a: number, r: string, n?: string) => void; onOpenChange: (o: boolean) => void }
const ajuste = vi.hoisted(() => ({ props: [] as PropsDelAjuste[] }))
vi.mock('@/components/AdjustStockDialog', () => ({
  AdjustStockDialog: (p: PropsDelAjuste) => {
    ajuste.props.push({ open: p.open, onConfirm: p.onConfirm, onOpenChange: p.onOpenChange })
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
import { olvidarPendientes } from '@/pages/Commissions/envioUnico'

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
  olvidarPendientes()
  acceso.negados.clear()
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
    // D2: con su llave de un solo envío (4º argumento).
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledWith('v1', 'a', expect.objectContaining({ quantity: 5 }), expect.any(String)))
    await waitFor(() => expect(avisos.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'products.toasts.saved' })))
  })

  // D2 (18-nov-2026, Codex r1 #7): sin respuesta no se sabe si el SERVIDOR ya sumó las piezas; volver a guardar las sumaría otra vez.
  it.each([
    ['sin respuesta (red)', Object.assign(new Error('Network Error'), {})],
    ['un 5xx', rechazo(502, { message: 'Bad Gateway' })],
  ])('%s: la ventana se queda abierta con su llave, relee la lista y avisa (Codex r3 #2)', async (_c, error) => {
    ajustar.adjustStock.mockRejectedValue(error)
    const dialogo = await abrirAjusteDe('Libreta')
    const lecturas = menu.getProducts.mock.calls.length
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    expect(avisos.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'products.toasts.adjustStockEnDudaTitle', description: 'products.toasts.adjustStockEnDuda' }),
    )
    await waitFor(() => expect(menu.getProducts.mock.calls.length).toBeGreaterThan(lecturas))
    expect(ajuste.props[ajuste.props.length - 1].open).toBe(true)
  })

  // D2 (Codex r1 #7, r2 #3): cada ajuste lleva su llave; si la respuesta se pierde, volver a guardar lo MISMO lleva la MISMA llave y el
  // SERVIDOR no lo suma dos veces.
  it('el ajuste lleva una llave y, tras perder la respuesta, volver a guardar en la MISMA ventana lleva la misma', async () => {
    ajustar.adjustStock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), {}))
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    ajuste.props[ajuste.props.length - 1].onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(2))
    const [primera, segunda] = ajustar.adjustStock.mock.calls.map(c => c[3])
    expect(primera).toMatch(/^[0-9a-f-]{36}$/)
    expect(segunda).toBe(primera)
  })

  it('dos ventanas con el mismo ajuste son dos ajustes: otra llave, aunque el primero quedara en duda (Codex r3 #2)', async () => {
    ajustar.adjustStock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), {}))
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Libreta')
    const abrir = async () => {
      await user.click(within(screen.getByText('Libreta').closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
      await user.click(await screen.findByRole('menuitem', { name: /products\.actions\.adjustStock/ }))
    }
    const ultima = () => ajuste.props[ajuste.props.length - 1]
    await abrir()
    await waitFor(() => expect(ultima().open).toBe(true))
    ultima().onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(avisos.toast).toHaveBeenCalled())
    act(() => ultima().onOpenChange(false))
    await waitFor(() => expect(ultima().open).toBe(false))
    await abrir()
    await waitFor(() => expect(ultima().open).toBe(true))
    ultima().onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(2))
    const [primera, segunda] = ajustar.adjustStock.mock.calls.map(c => c[3])
    expect(segunda).not.toBe(primera)
  })

  it('un ajuste distinto lleva otra llave', async () => {
    const dialogo = await abrirAjusteDe('Libreta')
    dialogo.onConfirm(5, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(1))
    const otra = await abrirAjusteDe('Libreta')
    otra.onConfirm(7, 'RECOUNT')
    await waitFor(() => expect(ajustar.adjustStock).toHaveBeenCalledTimes(2))
    const [primera, segunda] = ajustar.adjustStock.mock.calls.map(c => c[3])
    expect(segunda).not.toBe(primera)
  })

  // Codex r2 #4: el botón se queda con el permiso de siempre (`menu:update`); `inventory:adjust` lo filtra la marca blanca en el
  // DASHBOARD y no en el SERVIDOR, y cambiarlo escondía el botón a quien sí podía guardar.
  it('sin `menu:update` la opción no aparece (como antes)', async () => {
    acceso.negados.add('menu:update')
    const user = userEvent.setup()
    pintar()
    await screen.findByText('Libreta')
    await user.click(within(screen.getByText('Libreta').closest('tr')!).getByRole('button', { name: 'modifiers.actions.openMenu' }))
    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: /products\.actions\.adjustStock/ })).toBeNull()
  })
})
