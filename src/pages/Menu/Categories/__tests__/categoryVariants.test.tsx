/**
 * Variantes de producto, bloque 2 (Tarea 13): los selectores de productos de una CATEGORÍA. Una variante cambia de categoría desde su
 * familia: el server rechaza con 409 meterla en otra categoría (`assertNoGroupedProducts`). Aquí sale deshabilitada con la razón y, si ya
 * está en la categoría, su chip no se puede quitar — así nunca se manda el movimiento masivo que el server rechaza.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const svc = vi.hoisted(() => ({
  createMenuCategory: vi.fn(),
  getMenus: vi.fn(),
  getProducts: vi.fn(),
  getMenuCategory: vi.fn(),
  updateMenuCategory: vi.fn(),
  deleteMenuCategory: vi.fn(),
}))
vi.mock('@/services/menu.service', () => svc)
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: false, isResolved: true }) }))
vi.mock('@/components/SatKeyPicker', () => ({ SatKeyPicker: () => null }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
const migas = vi.hoisted(() => ({ setCustomSegment: () => undefined, clearCustomSegment: () => undefined }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => migas }))
// La llave, y la familia interpolada para ver que llega la correcta.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { familia?: string }) => (o?.familia ? `${k}:${o.familia}` : k),
    i18n: { language: 'es-MX' },
  }),
}))

import CreateCategory from '../createCategory'
import CategoryId from '../categoryId'

const productos = [
  { id: 'pm', name: 'Playera · M', productGroupId: 'g1', productGroupName: 'Playera' },
  { id: 'pl', name: 'Playera · L', productGroupId: 'g1', productGroupName: 'Playera' },
  { id: 'go', name: 'Gorra', productGroupId: null, productGroupName: null },
  { id: 'ca', name: 'Calcetas', productGroupId: null, productGroupName: null },
]

function pintar(ruta: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/categories/new" element={<CreateCategory />} />
          <Route path="/categories/:categoryId" element={<CategoryId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  svc.getMenus.mockResolvedValue([])
  svc.getProducts.mockResolvedValue(productos)
  svc.getMenuCategory.mockResolvedValue({
    id: 'c1',
    name: 'Ropa',
    active: true,
    menus: [],
    products: [
      { id: 'pm', name: 'Playera · M', productGroupId: 'g1' },
      { id: 'go', name: 'Gorra', productGroupId: null },
    ],
    availableFrom: null,
    availableUntil: null,
    availableDays: [],
  })
  svc.updateMenuCategory.mockResolvedValue({})
})

describe('selectores de productos de una categoría con variantes (Tarea 13)', () => {
  it('nueva categoría: una variante sale deshabilitada con «se cambia desde «Playera»»; un producto suelto, habilitado', async () => {
    pintar('/categories/new')
    await userEvent.click(await screen.findByPlaceholderText('forms.labels.selectProducts'))
    expect(await screen.findByRole('option', { name: 'Playera · M (variante.seCambiaDesde:Playera)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Gorra' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('🔴 editar categoría: la variante que ya está no se quita, la de fuera no se agrega, y el guardado la conserva', async () => {
    pintar('/categories/c1')
    const chipVariante = await screen.findByText('Playera · M')
    fireEvent.click(chipVariante) // sin la X: no se quita
    fireEvent.click(screen.getByText('Gorra')) // un producto suelto sí se quita
    expect(screen.getByText('Playera · M')).toBeInTheDocument()
    expect(screen.queryByText('Gorra')).not.toBeInTheDocument()

    const selector = screen.getByText('Playera · M').closest('button')!
    await userEvent.click(selector)
    const fuera = await screen.findByRole('option', { name: 'Playera · L (variante.seCambiaDesde:Playera)' })
    expect(fuera).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(fuera) // deshabilitada: no se agrega
    await userEvent.click(screen.getByRole('option', { name: 'Calcetas' }))
    await userEvent.keyboard('{Escape}')
    expect(within(selector).queryByText(/Playera · L/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'categoryDetail.buttons.save' }))
    await waitFor(() => expect(svc.updateMenuCategory).toHaveBeenCalledTimes(1))
    expect(svc.updateMenuCategory.mock.calls[0][2].avoqadoProducts.map((p: { value: string }) => p.value)).toEqual(['pm', 'ca'])
  })
})
