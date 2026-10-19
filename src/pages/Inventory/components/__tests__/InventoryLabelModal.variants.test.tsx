import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/services/menu.service', () => ({ getProducts: vi.fn(), getMenuCategories: vi.fn() }))
vi.mock('@/services/purchaseOrder.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/purchaseOrder.service')>()),
  purchaseOrderService: { getPurchaseOrders: vi.fn() },
}))

import { getMenuCategories, getProducts } from '@/services/menu.service'
import { purchaseOrderService } from '@/services/purchaseOrder.service'
import type { Product } from '@/types'
import { InventoryLabelModal } from '../InventoryLabelModal'

const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  sku: `PLA-${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
})

async function abrir(products: Array<Record<string, unknown>>) {
  vi.mocked(getProducts).mockResolvedValue(products as unknown as Product[])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InventoryLabelModal open onClose={() => {}} venueId="ven1" />
    </QueryClientProvider>,
  )
  await screen.findByPlaceholderText('Introduce el SKU, el GTIN o el nombre del artículo')
}
const buscar = async (texto: string, esperar: string) => {
  fireEvent.change(screen.getByPlaceholderText('Introduce el SKU, el GTIN o el nombre del artículo'), { target: { value: texto } })
  await screen.findByText(esperar)
}
// Las sugerencias son los botones junto a la caja de búsqueda (la caja y su lista viven en el mismo contenedor).
const sugerencias = () =>
  within(screen.getByPlaceholderText('Introduce el SKU, el GTIN o el nombre del artículo').closest('div.relative')!.parentElement!)
    .getAllByRole('button')
    .map(b => b.textContent)
const renglones = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => r.querySelector('.font-medium')?.textContent)

describe('Etiquetas: sugerencia «toda la familia»', () => {
  beforeEach(() => {
    vi.mocked(getMenuCategories).mockResolvedValue([])
    vi.mocked(purchaseOrderService.getPurchaseOrders).mockResolvedValue([] as never)
  })

  it('la familia sale primero y al elegirla agrega un renglón por variante', async () => {
    await abrir([{ id: 'a', name: 'Agua' }, variante('v1', 'S', 0), variante('v2', 'M', 1)])
    await buscar('playe', 'selector.todaLaFamilia:Playera:2')
    expect(sugerencias()).toEqual(['selector.todaLaFamilia:Playera:2', 'Playera · SPLA-S', 'Playera · MPLA-M'])
    expect(screen.getByText('selector.todaLaFamilia:Playera:2')).toHaveAttribute('data-tour', 'labels-family-suggestion-0')
    fireEvent.mouseDown(screen.getByText('selector.todaLaFamilia:Playera:2'))
    expect(renglones()).toEqual(['Playera · S', 'Playera · M'])
  })

  it('sólo agrega las variantes que faltan y el total de sugerencias sigue con tope de 8', async () => {
    const tallas = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
    await abrir(tallas.map((t, i) => variante(`v${i}`, t, i)))
    await buscar('PLA-M', 'Playera · M')
    fireEvent.mouseDown(screen.getByText('Playera · M'))
    await buscar('playera', 'selector.todaLaFamilia:Playera:9')
    expect(sugerencias()).toHaveLength(8)
    fireEvent.mouseDown(screen.getByText('selector.todaLaFamilia:Playera:9'))
    expect(renglones()).toEqual(['Playera · M', ...tallas.filter(t => t !== 'M').map(t => `Playera · ${t}`)])
  })

  it('🔴 sin familias las sugerencias son las de hoy', async () => {
    await abrir([
      { id: 'a', name: 'Agua' },
      { id: 'b', name: 'Agua mineral', sku: 'AM1' },
    ])
    await buscar('agua', 'Agua mineral')
    expect(sugerencias()).toEqual(['Agua', 'Agua mineralAM1'])
  })
})
