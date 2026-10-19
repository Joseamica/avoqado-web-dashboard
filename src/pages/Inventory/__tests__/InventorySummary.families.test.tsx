/**
 * Variantes de producto, bloque 2 (Tarea 15): la pestaña «Artículos e Ingredientes» del Resumen de existencias agrupa cada familia
 * en una fila con la suma; la edición de existencias sigue por variante. `t` estable (como el real); vitest con mockReset.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ products: vi.fn(), materials: vi.fn(), adjust: vi.fn() }))
const estables = vi.hoisted(() => {
  const t = (k: string, o?: unknown) =>
    [k, ...(o && typeof o === 'object' ? Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)])) : [])].join(':')
  return { i18n: { t, i18n: { language: 'es' } }, unidades: { getShortLabel: (u: string) => u }, tour: { start: () => {} } }
})

vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/cafe' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }))
vi.mock('@/hooks/useStockAdjustmentTour', () => ({ useStockAdjustmentTour: () => estables.tour }))
vi.mock('@/hooks/useInventoryWelcomeTour', () => ({ useInventoryWelcomeTour: () => estables.tour }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => estables.unidades }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../components/InventoryLabelModal', () => ({ InventoryLabelModal: () => null }))
vi.mock('../components/AdjustStockDialog', () => ({ AdjustStockDialog: () => null }))
vi.mock('@/services/menu.service', () => ({ getProducts: (...a: unknown[]) => mocks.products(...a) }))
vi.mock('@/services/inventory.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/inventory.service')>()),
  rawMaterialsApi: { getAll: (...a: unknown[]) => mocks.materials(...a) },
  productInventoryApi: { adjustStock: (...a: unknown[]) => mocks.adjust(...a) },
}))
vi.mock('@/services/supplier.service', () => ({ supplierService: { getSuppliers: () => Promise.resolve([]) } }))

import InventorySummary from '../InventorySummary'

const producto = (id: string, name: string, stock: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  sku: `SKU-${id}`,
  price: 100,
  cost: 40,
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
  availableQuantity: stock,
  inventory: { minimumStock: 2 },
  ...extra,
})
const variante = (id: string, talla: string, pos: number, stock: number) =>
  producto(id, `Playera · ${talla}`, stock, {
    productGroupId: 'g1',
    productGroupName: 'Playera',
    variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  })
const harina = { id: 'r1', name: 'Harina', sku: 'HAR', unit: 'KILOGRAM', currentStock: 12, reorderPoint: 5, costPerUnit: 9 }

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InventorySummary />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}

const filasDeDatos = () => screen.getAllByRole('row').filter(r => r.closest('thead') === null)
const editores = (dentro: ParentNode = document) => dentro.querySelectorAll('[data-tour="stock-edit-trigger"]')

beforeEach(() => {
  mocks.adjust.mockResolvedValue({ data: {} })
  mocks.materials.mockResolvedValue({ data: [harina] })
  // M: 10, S: 1 (bajo su mínimo de 2). La suma, 11, no está baja: la familia igual debe avisar.
  mocks.products.mockResolvedValue([producto('a', 'Agua', 10), variante('v2', 'M', 1, 10), variante('v1', 'S', 0, 1)])
})

describe('InventorySummary — existencias agrupadas por familia', () => {
  it('🔴 sin familias: las mismas filas, en el mismo orden, cada producto con su editor de existencias', async () => {
    mocks.products.mockResolvedValue([producto('z', 'Zeta', 5), producto('a', 'Agua', 3)])
    pintar()
    await screen.findByText('Zeta')
    const nombres = filasDeDatos().map(f => ['Zeta', 'Agua', 'Harina'].find(n => within(f).queryByText(n)))
    expect(nombres).toEqual(['Zeta', 'Agua', 'Harina'])
    expect(editores()).toHaveLength(2)
    expect(screen.queryByText(/^familias\./)).not.toBeInTheDocument()
  })

  it('una familia es UNA fila con la suma y sin editor; desplegarla muestra el editor de cada variante; el ingrediente no cambia', async () => {
    pintar()
    await screen.findByText('Playera')
    const nombres = filasDeDatos().map(f => ['Agua', 'Playera', 'Harina'].find(n => within(f).queryByText(n)))
    expect(nombres).toEqual(['Agua', 'Playera', 'Harina'])

    const familia = screen.getByText('Playera').closest('tr')!
    expect(within(familia).getByText('familias.variantes:2')).toBeInTheDocument()
    expect(within(familia).getAllByText('11').length).toBeGreaterThan(0)
    expect(within(familia).getByText(/Stock Bajo/)).toBeInTheDocument() // la talla S está bajo su mínimo
    expect(editores(familia)).toHaveLength(0)
    expect(editores()).toHaveLength(1) // sólo Agua

    fireEvent.click(within(familia).getByRole('button', { name: 'familias.ver:Playera' }))
    const s = screen.getByText('Playera · S').closest('tr')!
    const m = screen.getByText('Playera · M').closest('tr')!
    expect(editores(s)[0]).toHaveTextContent('1')
    expect(editores(m)[0]).toHaveTextContent('10')
    expect(editores()).toHaveLength(3)
  })

  it('🔴 un ajuste nunca cae en OTRO producto: el popover abierto sigue con SU producto aunque la lista se reacomode', async () => {
    mocks.products.mockResolvedValue([producto('a', 'Aceite', 0), producto('b', 'Botella', 1), producto('c', 'Cera', 1)])
    const qc = pintar()
    await screen.findByText('Botella')
    fireEvent.click(editores(screen.getByText('Botella').closest('tr')!)[0])
    fireEvent.change(await screen.findByPlaceholderText('0'), { target: { value: '5' } })

    // Llega un refetch sin Aceite (p. ej. ya se repuso y salió del filtro «Stock Bajo»): Botella pasa a la fila 0 y Cera a la 1.
    mocks.products.mockResolvedValue([producto('b', 'Botella', 1), producto('c', 'Cera', 1)])
    await act(async () => {
      await qc.refetchQueries()
    })
    await waitFor(() => expect(screen.queryByText('Aceite')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(mocks.adjust).toHaveBeenCalledTimes(1))
    expect(mocks.adjust).toHaveBeenCalledWith('v1', 'b', expect.anything())
    expect(mocks.adjust).not.toHaveBeenCalledWith('v1', 'c', expect.anything())
  })
})
