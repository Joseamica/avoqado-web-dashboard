/**
 * Variantes de producto, bloque 2 (Tarea 10): en la lista de Productos, «Variantes › Elegir productos para agrupar» → casillas propias →
 * barra «N elegidos» → diálogo prellenado (en el orden en que se eligieron) → al terminar se abre la familia nueva.
 * Arnés de `Products.variants.test.tsx`; aquí la cabecera se captura (el menú vive en ella) y el diálogo se simula (tiene su prueba).
 * Tarea 11: «Agrupar productos que ya tengo» (sugerencias y archivo de Shopify) y el aviso de sugerencias, también simulados.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const menu = vi.hoisted(() => ({ getProducts: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn() }))
const estables = vi.hoisted(() => {
  const cabecera = { actions: null as ReactNode }
  const t = (k: string, o?: Record<string, unknown>) =>
    [k, ...Object.entries(o ?? {}).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':')
  return {
    cabecera,
    setHeader: (h: { actions?: ReactNode }) => {
      if (h.actions) cabecera.actions = h.actions
    },
    start: () => {},
    i18n: { t, i18n: { language: 'es' } },
    inicial: undefined as unknown,
  }
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
vi.mock('../components/VariantsMenu', () => ({
  VariantsMenu: ({ items }: { items: Array<{ key: string; label: string; onSelect: () => void }> }) => (
    <>
      {items.map(i => (
        <button key={i.key} onClick={i.onSelect}>
          {i.label}
        </button>
      ))}
    </>
  ),
}))
vi.mock('../components/ProductGroupDialog', () => ({
  ProductGroupDialog: (p: { open: boolean; groupId: string | null }) => (p.open ? <div data-testid="familia-abierta">{p.groupId}</div> : null),
}))
vi.mock('../components/GroupExistingDialog', () => ({
  GroupExistingDialog: (p: { inicial: unknown; onDone: (groupId: string) => void }) => {
    estables.inicial = p.inicial
    return <button onClick={() => p.onDone('g9')}>agrupado</button>
  },
}))
vi.mock('../components/GroupFromSourcesDialog', () => ({
  GroupFromSourcesDialog: (p: { open: boolean; onClose: () => void; onDone: (groupId: string) => void }) =>
    p.open ? (
      <div data-testid="fuentes-abiertas">
        <button onClick={() => p.onDone('g7')}>fuentes-agrupado</button>
        <button onClick={p.onClose}>fuentes-cerrar</button>
      </div>
    ) : null,
}))
vi.mock('../components/SuggestionsBanner', () => ({
  SuggestionsBanner: (p: { onRevisar: () => void }) => <button onClick={p.onRevisar}>aviso-revisar</button>,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import Products from '../Products'

const producto = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, price: 20, type: 'REGULAR', active: true, imageUrl: null, trackInventory: false, modifierGroups: [], updatedAt: '2026-10-01', ...extra,
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
const casilla = (name: string) => screen.getByRole('checkbox', { name: `agrupar.elegirProducto:${name}` })

beforeEach(() => {
  estables.cabecera.actions = null
  estables.inicial = undefined
  menu.getProducts.mockResolvedValue([
    producto('t27', 'Tenis - Talla 27', { sku: 'T27' }),
    producto('t26', 'Tenis - Talla 26'),
    producto('ev', 'Boleto concierto', { type: 'EVENT' }),
    producto('v1', 'Playera · S', { productGroupId: 'g1', productGroupName: 'Playera', variantOptions: [{ name: 'Talla', value: 'S', namePosition: 0, valuePosition: 0 }] }),
  ])
})

describe('Products — elegir productos para agrupar', () => {
  it('elige con casillas propias, prellena el diálogo en el orden elegido y al terminar abre la familia nueva', async () => {
    pintar()
    await screen.findByText('Tenis - Talla 26')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    render(<>{estables.cabecera.actions}</>)
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.elegir' }))

    // una familia y un evento no se pueden agrupar: casilla apagada con el motivo
    expect(casilla('Playera')).toBeDisabled()
    expect(casilla('Boleto concierto')).toBeDisabled()
    expect(casilla('Boleto concierto').closest('[title]')).toHaveAttribute('title', 'agrupar.noAgrupable')
    // tocar la fila de algo que no se agrupa no abre nada
    fireEvent.click(screen.getByText('Boleto concierto'))

    fireEvent.click(casilla('Tenis - Talla 26'))
    fireEvent.click(screen.getByText('Tenis - Talla 27')) // la fila entera también marca
    expect(screen.getByText('agrupar.elegidos:2')).toBeInTheDocument()
    expect(casilla('Tenis - Talla 26')).toBeChecked()

    fireEvent.click(within(screen.getByText('agrupar.elegidos:2').parentElement!).getByRole('button', { name: 'agrupar.agruparComo' }))
    expect(estables.inicial).toEqual({
      name: 'Tenis',
      optionNames: ['Talla'], // «X - Talla N» ya dice cómo se llama la opción
      members: [
        { productId: 't26', name: 'Tenis - Talla 26', sku: undefined, values: ['26'] },
        { productId: 't27', name: 'Tenis - Talla 27', sku: 'T27', values: ['27'] },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'agrupado' }))
    expect(screen.getByTestId('familia-abierta')).toHaveTextContent('g9')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/^agrupar\.elegidos/)).not.toBeInTheDocument()
  })

  it('«Cancelar» sale del modo y olvida lo elegido', async () => {
    pintar()
    await screen.findByText('Tenis - Talla 26')
    render(<>{estables.cabecera.actions}</>)
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.elegir' }))
    fireEvent.click(casilla('Tenis - Talla 26'))
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.cancelar' }))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.elegir' }))
    expect(casilla('Tenis - Talla 26')).not.toBeChecked()
    expect(screen.getByText('agrupar.elegidos:0')).toBeInTheDocument()
  })
})

describe('Products — agrupar productos que ya tengo (sugerencias y archivo de Shopify)', () => {
  it('la entrada del menú «Variantes» abre el diálogo; lo que se agrupa ahí abre la familia nueva ENCIMA, sin cerrarlo', async () => {
    pintar()
    await screen.findByText('Tenis - Talla 26')
    render(<>{estables.cabecera.actions}</>)
    expect(screen.queryByTestId('fuentes-abiertas')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'fuentes.titulo' }))
    expect(screen.getByTestId('fuentes-abiertas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'fuentes-agrupado' }))
    expect(screen.getByTestId('familia-abierta')).toHaveTextContent('g7')
    expect(screen.getByTestId('fuentes-abiertas')).toBeInTheDocument() // se sigue con los demás grupos al cerrar la familia

    fireEvent.click(screen.getByRole('button', { name: 'fuentes-cerrar' }))
    expect(screen.queryByTestId('fuentes-abiertas')).not.toBeInTheDocument()
  })

  it('«Revisar» del aviso abre el mismo diálogo', async () => {
    pintar()
    await screen.findByText('Tenis - Talla 26')
    fireEvent.click(screen.getByRole('button', { name: 'aviso-revisar' }))
    expect(screen.getByTestId('fuentes-abiertas')).toBeInTheDocument()
  })
})
