/**
 * Encargo 08cc59 (15-nov): «Eliminar categoría» rechazado por el servidor cerraba la ventana sin decir nada. Ahora sale un aviso
 * con el porqué, y una confirmación manda UN solo borrado aunque se le dé doble clic (en el banco salían dos DELETE y dos avisos).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const svc = vi.hoisted(() => ({
  getMenus: vi.fn(),
  getProducts: vi.fn(),
  getMenuCategory: vi.fn(),
  updateMenuCategory: vi.fn(),
  deleteMenuCategory: vi.fn(),
}))
vi.mock('@/services/menu.service', () => svc)
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/mi-tienda' }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: false, isResolved: true }) }))
// El diálogo real se queda en pantalla durante su animación de salida y un doble clic le llega dos veces al mismo botón (lo
// que se vio en el banco). Aquí el botón de confirmar no se va: así la prueba ve los dos clics.
vi.mock('@/components/alert-dialog', () => ({
  default: ({ onRightButtonClick }: { onRightButtonClick?: () => void }) => (
    <button type="button" onClick={onRightButtonClick}>
      confirmar-eliminar
    </button>
  ),
}))
vi.mock('@/components/SatKeyPicker', () => ({ SatKeyPicker: () => null }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
const migas = vi.hoisted(() => ({ setCustomSegment: () => undefined, clearCustomSegment: () => undefined }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => migas }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k),
    i18n: { language: 'es-MX' },
  }),
}))

import CategoryId from '../categoryId'

function pintar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/categories/c1']}>
        <Routes>
          <Route path="/categories/:categoryId" element={<CategoryId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  toast.mockReset()
  svc.deleteMenuCategory.mockReset()
  svc.getMenus.mockResolvedValue([])
  svc.getProducts.mockResolvedValue([])
  svc.getMenuCategory.mockResolvedValue({
    id: 'c1',
    name: 'Postres',
    active: true,
    menus: [],
    products: [],
    availableFrom: null,
    availableUntil: null,
    availableDays: [],
  })
})

async function confirmarConDobleClic() {
  pintar()
  const confirmar = await screen.findByRole('button', { name: 'confirmar-eliminar' })
  fireEvent.click(confirmar)
  fireEvent.click(confirmar)
}

describe('eliminar una categoría', () => {
  it('rechazado: sale UN aviso en rojo con el porqué (antes no salía nada)', async () => {
    svc.deleteMenuCategory.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: 'No se puede eliminar «Postres»: …',
          code: 'CATEGORY_HAS_PRODUCTS',
          details: { productos: 2, pausados: 0, ejemplos: ['Flan', 'Pay'] },
        },
      },
    })
    await confirmarConDobleClic()

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'categoryDetail.deleteBlocked.title', variant: 'destructive' })),
    )
    expect(svc.deleteMenuCategory).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls.filter(([a]) => a.variant === 'destructive')).toHaveLength(1)
  })

  it('doble clic al confirmar: UN solo borrado', async () => {
    svc.deleteMenuCategory.mockResolvedValue(undefined)
    await confirmarConDobleClic()

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'categoryDetail.toasts.deleted' })))
    expect(svc.deleteMenuCategory).toHaveBeenCalledTimes(1)
  })
})
