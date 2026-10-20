/**
 * Variantes de producto, bloque 2 (Tarea 15): «Existencias por cantidad» agrupa cada familia en una fila con la suma.
 * `t` (estable, como el real) devuelve la clave y, si hay valores, los pega con «:» (`familias.variantes:2`). vitest corre con
 * mockReset: las respuestas van en beforeEach.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const menu = vi.hoisted(() => ({ getProducts: vi.fn() }))
const ajuste = vi.hoisted(() => ({ producto: null as null | { id: string } }))
// Estable entre renders, como en la app (react-i18next memoiza `t`): un `t` nuevo en cada render remontaría las celdas.
const estables = vi.hoisted(() => {
  const t = (k: string, o?: unknown) =>
    [k, ...(o && typeof o === 'object' ? Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)])) : [])].join(':')
  return { i18n: { t, i18n: { language: 'es' } } }
})

vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/services/menu.service', () => ({ getProducts: (...a: unknown[]) => menu.getProducts(...a) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('../components/InventoryMovementsDialog', () => ({ InventoryMovementsDialog: () => null }))
vi.mock('../components/AdjustInventoryStockDialog', () => ({
  AdjustInventoryStockDialog: (p: { open: boolean; product: { id: string } | null }) => {
    if (p.open) ajuste.producto = p.product
    return null
  },
}))

import ProductStock from '../ProductStock'

const producto = (id: string, name: string, stock: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  sku: `SKU-${id}`,
  price: 100,
  cost: 40,
  unit: 'UNIT',
  active: true,
  trackInventory: true,
  inventoryMethod: 'QUANTITY',
  inventory: { currentStock: stock, minimumStock: 2 },
  ...extra,
})
const variante = (id: string, talla: string, pos: number, stock: number) =>
  producto(id, `Playera · ${talla}`, stock, {
    productGroupId: 'g1',
    productGroupName: 'Playera',
    variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  })

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ProductStock />
    </QueryClientProvider>,
  )
}

const filasDeDatos = () => screen.getAllByRole('row').filter(r => r.closest('thead') === null)
const chevron = () => screen.getByRole('button', { name: 'familias.ver:Playera' })
const AJUSTAR = 'productStock.actions.adjustStock'

beforeEach(() => {
  ajuste.producto = null
  // M: 10 (bien), S: 1 (bajo su mínimo de 2). La suma, 11, no está baja: la familia igual debe avisar.
  menu.getProducts.mockResolvedValue([producto('a', 'Agua', 10), variante('v2', 'M', 1, 10), variante('v1', 'S', 0, 1)])
})

describe('ProductStock — existencias agrupadas por familia', () => {
  it('🔴 sin familias: las mismas filas, en el mismo orden, cada una con su ajuste, y nada de familias', async () => {
    menu.getProducts.mockResolvedValue([producto('z', 'Zeta', 5), producto('a', 'Agua', 3), producto('c', 'Café', 0)])
    pintar()
    await screen.findByText('Zeta')
    const nombres = filasDeDatos().map(f => ['Zeta', 'Agua', 'Café'].find(n => within(f).queryByText(n)))
    expect(nombres).toEqual(['Zeta', 'Agua', 'Café'])
    expect(screen.getAllByRole('button', { name: AJUSTAR })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /^familias\.ver/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^familias\./)).not.toBeInTheDocument()
  })

  it('una familia es UNA fila con la suma y sin ajuste; desplegarla muestra cada variante con su propio ajuste', async () => {
    pintar()
    await screen.findByText('Playera')
    expect(filasDeDatos()).toHaveLength(2)
    const familia = screen.getByText('Playera').closest('tr')!
    expect(within(familia).getByText('familias.variantes:2')).toBeInTheDocument()
    expect(within(familia).getByText('familias.suma')).toBeInTheDocument()
    expect(within(familia).getByText(/^11 /)).toBeInTheDocument()
    // una talla bajo su mínimo no se esconde en la suma
    expect(within(familia).getByText('productStock.status.lowStock')).toBeInTheDocument()
    expect(within(familia).queryByRole('button', { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByText('Playera · S')).not.toBeInTheDocument()

    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    chevron().focus()
    fireEvent.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    expect(chevron()).toHaveFocus() // la celda no se remontó

    const s = screen.getByText('Playera · S').closest('tr')!
    const m = screen.getByText('Playera · M').closest('tr')!
    expect(s.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // S antes que M
    fireEvent.click(within(s).getByRole('button', { name: AJUSTAR }))
    expect(ajuste.producto?.id).toBe('v1')

    fireEvent.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(chevron()).toHaveFocus()
    expect(screen.queryByText('Playera · S')).not.toBeInTheDocument()
  })

  it('buscar por el SKU de una talla deja la familia desplegada con SÓLO esa talla, y la suma es la de esa talla', async () => {
    pintar()
    await screen.findByText('Playera')
    fireEvent.change(screen.getByPlaceholderText('productStock.searchPlaceholder'), { target: { value: 'SKU-v2' } })
    await waitFor(() => expect(screen.queryByText('Agua')).not.toBeInTheDocument())
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Playera · M')).toBeInTheDocument()
    expect(screen.queryByText('Playera · S')).not.toBeInTheDocument()
    const familia = screen.getByText('Playera').closest('tr')!
    expect(within(familia).getByText(/^10 /)).toBeInTheDocument()
    // la suma ya no es de toda la familia: el rótulo lo dice
    expect(within(familia).getByText('familias.sumaFiltrada')).toBeInTheDocument()
    expect(within(familia).queryByText('familias.suma')).not.toBeInTheDocument()
  })
})
