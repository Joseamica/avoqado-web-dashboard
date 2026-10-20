/**
 * Variantes de producto, bloque 2 (Tarea 9): la lista de Productos agrupada por familia («Playera · 2 variantes»).
 * `t` (estable, como el real) devuelve la clave y, si hay valores, los pega con «:» (`lista.variantes:2`). vitest corre con mockReset: las respuestas van en
 * beforeEach. 🔴 El asistente de producto queda MONTADO aunque esté cerrado: se capturan sus props, nunca se busca «que no esté».
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const menu = vi.hoisted(() => ({ getProducts: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn() }))
const asistente = vi.hoisted(() => ({ props: [] as Array<{ open: boolean; mode: string }> }))
// Estables entre renders, como en la app (react-i18next memoiza `t`): un `t` nuevo en cada render remontaría todas las celdas.
const estables = vi.hoisted(() => {
  const t = (k: string, o?: Record<string, unknown>) =>
    [k, ...Object.entries(o ?? {}).flatMap(([clave, valor]) => (clave === 'defaultValue' ? [] : [String(valor)]))].join(':')
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
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({
  ProductWizardDialog: (p: { open: boolean; mode: string }) => {
    asistente.props.push({ open: p.open, mode: p.mode })
    return null
  },
}))
vi.mock('../components/ProductGroupDialog', () => ({
  ProductGroupDialog: (p: { open: boolean; groupId: string | null; onClose: () => void }) =>
    p.open ? (
      <div data-testid="familia-abierta">
        {p.groupId}
        <button onClick={p.onClose}>cerrar-familia</button>
      </div>
    ) : null,
}))
vi.mock('../components/SuggestionsBanner', () => ({ SuggestionsBanner: () => null })) // tiene su prueba; aquí pediría el plan al server
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import Products from '../Products'

const suelto = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  price: 20,
  type: 'REGULAR',
  active: true,
  imageUrl: null,
  trackInventory: false,
  modifierGroups: [],
  updatedAt: '2026-10-01',
  ...extra,
})
const variante = (id: string, talla: string, pos: number, sku: string) =>
  suelto(id, `Playera · ${talla}`, {
    sku,
    price: 199 + pos * 50,
    productGroupId: 'g1',
    productGroupName: 'Playera',
    productGroupImageUrl: null,
    variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  })

function Ubicacion() {
  const l = useLocation()
  return <div data-testid="ubicacion">{l.search}</div>
}

function pintar(ruta = '/venues/mi-tienda/menumaker/products') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Products />
        <Ubicacion />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const filasDeDatos = () => screen.getAllByRole('row').filter(r => r.closest('thead') === null)
const conFamilia = () => [suelto('a', 'Agua'), variante('v2', 'M', 1, 'PLA-M'), variante('v1', 'S', 0, 'PLA-S')]
const editoAlgunaVez = () => asistente.props.some(p => p.open && p.mode === 'edit')

beforeEach(() => {
  asistente.props = []
  menu.getProducts.mockResolvedValue(conFamilia())
})

describe('Products — la lista agrupada por familia', () => {
  it('🔴 sin familias: las mismas filas, en el MISMO orden que llegan, y sin insignias de variantes', async () => {
    menu.getProducts.mockResolvedValue([suelto('z', 'Zeta'), suelto('a', 'Agua'), suelto('c', 'Café')])
    pintar()
    await screen.findByText('Zeta')
    const nombres = filasDeDatos().map(f => ['Zeta', 'Agua', 'Café'].find(n => within(f).queryByText(n)))
    expect(nombres).toEqual(['Zeta', 'Agua', 'Café'])
    expect(screen.queryByText(/^lista\.variantes/)).not.toBeInTheDocument()
    // un producto suelto sigue abriendo el asistente en modo edición, como hoy
    fireEvent.click(screen.getByText('Agua'))
    expect(asistente.props).toContainEqual({ open: true, mode: 'edit' })
    expect(screen.queryByTestId('familia-abierta')).not.toBeInTheDocument()
  })

  it('una familia es UNA fila; el chevron la despliega y tocar la fila abre la familia', async () => {
    pintar()
    await screen.findByText('Playera')
    expect(filasDeDatos()).toHaveLength(2)
    expect(screen.getByText('lista.variantes:2')).toBeInTheDocument()
    expect(screen.queryByText('PLA-S')).not.toBeInTheDocument()

    const chevron = () => screen.getByRole('button', { name: 'lista.verVariantes:Playera' })
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('PLA-S')).toBeInTheDocument()
    expect(screen.getByText('PLA-M')).toBeInTheDocument()
    // el chevron no abre la familia: sólo despliega
    expect(screen.queryByTestId('familia-abierta')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Playera'))
    expect(screen.getByTestId('familia-abierta')).toHaveTextContent('g1')
    expect(editoAlgunaVez()).toBe(false)
  })

  it('el chevron conserva el foco del teclado al desplegar y al plegar (la celda no se remonta)', async () => {
    pintar()
    await screen.findByText('Playera')
    const chevron = () => screen.getByRole('button', { name: 'lista.verVariantes:Playera' })
    chevron().focus()
    fireEvent.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    expect(chevron()).toHaveFocus()
    fireEvent.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(chevron()).toHaveFocus()
  })

  it('buscar por el SKU de una talla deja la familia desplegada con SÓLO esa talla', async () => {
    pintar()
    await screen.findByText('Playera')
    fireEvent.click(document.querySelector('.lucide-search')!.closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('common:search'), { target: { value: 'PLA-M' } })
    await waitFor(() => expect(screen.queryByText('Agua')).not.toBeInTheDocument())
    expect(screen.getByText('Playera')).toBeInTheDocument()
    expect(screen.getByText('PLA-M')).toBeInTheDocument()
    expect(screen.queryByText('PLA-S')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'lista.verVariantes:Playera' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('con ?familia=g1 en la URL la familia se abre al cargar, y al cerrarla se quita el parámetro', async () => {
    pintar('/venues/mi-tienda/menumaker/products?familia=g1')
    expect(await screen.findByTestId('familia-abierta')).toHaveTextContent('g1')
    fireEvent.click(screen.getByText('cerrar-familia'))
    expect(screen.queryByTestId('familia-abierta')).not.toBeInTheDocument()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^$/)
  })

  it('con ?familia= vacío no abre nada', async () => {
    pintar('/venues/mi-tienda/menumaker/products?familia=')
    await screen.findByText('Playera')
    expect(screen.queryByTestId('familia-abierta')).not.toBeInTheDocument()
  })

  it('«Editar» en una variante abre la familia, nunca el asistente de producto suelto', async () => {
    pintar()
    await screen.findByText('Playera')
    fireEvent.click(screen.getByRole('button', { name: 'lista.verVariantes:Playera' }))
    const filaM = screen.getByText('PLA-M').closest('tr')!
    fireEvent.click(within(filaM).getByRole('button', { name: 'lista.editarVariante:Playera · M' }))
    expect(screen.getByTestId('familia-abierta')).toHaveTextContent('g1')
    expect(editoAlgunaVez()).toBe(false)
    // el asistente sigue montado (cerrado), no desaparece
    expect(asistente.props.length).toBeGreaterThan(0)
  })
})
