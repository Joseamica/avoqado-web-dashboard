import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venue: { id: 'ven1', name: 'Tienda' } }) }))
vi.mock('@/services/supplier.service', () => ({ supplierService: { getSuppliers: vi.fn() } }))
vi.mock('@/services/inventory.service', () => ({ rawMaterialsApi: { getAll: vi.fn() } }))
vi.mock('@/services/menu.service', () => ({ getProducts: vi.fn() }))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { rawMaterialsApi } from '@/services/inventory.service'
import { getProducts } from '@/services/menu.service'
import { supplierService } from '@/services/supplier.service'
import type { Product } from '@/types'
import { PurchaseOrderWizard } from '../PurchaseOrderWizard'

const variante = (id: string, talla: string, pos: number, extra: object = {}) => ({
  id,
  name: `Playera · ${talla}`,
  trackInventory: true,
  unit: 'UNIT',
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  ...extra,
})

function abrir(products: Array<Record<string, unknown>>) {
  vi.mocked(getProducts).mockResolvedValue(products as unknown as Product[])
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PurchaseOrderWizard open onClose={() => {}} />
    </QueryClientProvider>,
  )
}
const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
async function abrirArticulos(user: ReturnType<typeof userEvent.setup>, fila = 0) {
  await waitFor(() => expect(getProducts).toHaveBeenCalled())
  // El combobox no toma nombre de su texto: se busca el del renglón.
  await user.click(within(filas()[fila]).getByRole('combobox'))
  return screen.findByPlaceholderText('wizard.searchMaterialPlaceholder')
}

describe('Orden de compra: «toda la familia»', () => {
  beforeEach(() => {
    vi.mocked(supplierService.getSuppliers).mockResolvedValue({ data: [] } as never)
    vi.mocked(rawMaterialsApi.getAll).mockResolvedValue({ data: { data: [] } } as never)
  })

  it('elegir la familia llena el renglón con la primera variante comprable y agrega uno por cada otra', async () => {
    const user = userEvent.setup()
    // «XL» no rastrea existencias: no se puede comprar y no cuenta.
    abrir([variante('v1', 'S', 0), variante('v2', 'M', 1), variante('v3', 'XL', 2, { trackInventory: false })])
    await abrirArticulos(user)
    await user.click(await screen.findByText('selector.todaLaFamilia:Playera:2'))
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(within(filas()[0]).getByRole('combobox')).toHaveTextContent('Playera · S')
    expect(within(filas()[1]).getByRole('combobox')).toHaveTextContent('Playera · M')
  })

  it('si todas sus variantes ya están en la orden, avisa (sin error) y no agrega renglones', async () => {
    const user = userEvent.setup()
    abrir([variante('v1', 'S', 0), variante('v2', 'M', 1)])
    await abrirArticulos(user)
    await user.click(await screen.findByText('selector.todaLaFamilia:Playera:2'))
    await waitFor(() => expect(filas()).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: 'wizard.addItem' }))
    await abrirArticulos(user, 2)
    await user.click(await screen.findByText('selector.todaLaFamilia:Playera:2'))
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toEqual({ description: expect.stringContaining('selector.familiaYaEnLaOrden:Playera') })
    expect(filas()).toHaveLength(3)
    expect(within(filas()[2]).getByRole('combobox')).toHaveTextContent('wizard.selectMaterial')
  })

  it('🔴 sin familias la lista de artículos es la de hoy', async () => {
    const user = userEvent.setup()
    abrir([{ id: 'a', name: 'Refresco', trackInventory: true, unit: 'UNIT' }])
    await abrirArticulos(user)
    expect(await screen.findByText('Refresco')).toBeInTheDocument()
    expect(screen.queryByText(/selector\.todaLaFamilia/)).not.toBeInTheDocument()
  })
})
