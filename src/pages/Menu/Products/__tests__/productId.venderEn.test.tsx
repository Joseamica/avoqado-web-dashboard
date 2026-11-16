/**
 * D1 · «Vender en» en la ficha del producto: sólo la casilla habilita «Guardar», y entonces guardar NO toca el producto.
 * Arnés copiado de `productId.iva.test.tsx`, más los canales de delivery y el permiso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  deleteProduct: vi.fn(),
  getIvaPorProducto: vi.fn(),
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => svc)
const delivery = vi.hoisted(() => ({ getChannels: vi.fn(), ponerProductoEnCanales: vi.fn() }))
vi.mock('@/services/delivery.service', () => delivery)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p === 'delivery-channels:manage' }) }))
vi.mock('@/services/inventory.service', () => ({ recipesApi: { get: vi.fn() } }))
vi.mock('@/api', () => ({ default: { patch: vi.fn(), get: vi.fn() } }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-tienda', venue: { id: 'v1', organizationId: 'o1' } }),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
const migas = vi.hoisted(() => ({ setCustomSegment: () => undefined, clearCustomSegment: () => undefined }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => migas }))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    onCropComplete: () => undefined,
    handleFileUpload: () => undefined,
    handleCropConfirm: () => undefined,
    handleFileRemove: () => undefined,
    setImageForCrop: () => undefined,
    setCrop: () => undefined,
    setZoom: () => undefined,
  }),
}))
vi.mock('@/pages/Inventory/components/ProductWizardDialog', () => ({ ProductWizardDialog: () => null }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import ProductId from '../productId'

const producto = {
  id: 'p1',
  venueId: 'v1',
  name: 'Café en grano',
  sku: 'CAFE-001',
  gtin: '',
  description: '',
  price: 250,
  type: 'REGULAR',
  imageUrl: null,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Café' },
  modifierGroups: [],
  trackInventory: false,
  inventoryMethod: null,
  ivaTratamiento: 'IVA_16',
}
const rappi = {
  id: 'l1',
  venueId: 'v1',
  provider: 'RAPPI',
  status: 'ACTIVE',
  orderAcceptanceMode: 'AUTO',
  autoSyncMenu: true,
  lastMenuSyncAt: null,
  externalLocationId: 'ext',
  config: { productoIds: ['otro'] },
}

function renderFicha() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/menumaker/products/p1']}>
        <Routes>
          <Route path="/menumaker/products/:productId" element={<ProductId />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const guardarBtn = () => screen.getByRole('button', { name: /save|guardar/i })

beforeEach(() => {
  svc.getProduct.mockResolvedValue(producto)
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Café' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.getIvaPorProducto.mockResolvedValue({ encendido: true, bloqueos: [], avisos: [], facturasSinSello: [] })
  svc.updateProduct.mockResolvedValue(producto)
  delivery.getChannels.mockResolvedValue([rappi])
  delivery.ponerProductoEnCanales.mockResolvedValue([{ linkId: 'l1', dentro: true }])
})

describe('ficha del producto: casilla «Vender en» (D1)', () => {
  it('con la ficha sin cambios, marcar sólo Rappi habilita «Guardar», y guardar pone el producto en Rappi sin tocar el producto', async () => {
    renderFicha()
    const casilla = await screen.findByRole('checkbox', { name: 'Rappi' })
    expect(casilla).not.toBeChecked()
    expect(guardarBtn()).toBeDisabled()
    await userEvent.click(casilla)
    expect(guardarBtn()).toBeEnabled()
    await userEvent.click(guardarBtn())
    await waitFor(() => expect(delivery.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true }))
    expect(svc.updateProduct).not.toHaveBeenCalled()
  })

  it('si cambió algo más, primero se guarda el producto y luego se pone en Rappi', async () => {
    renderFicha()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Rappi' }))
    const precio = await screen.findByDisplayValue('250')
    await userEvent.clear(precio)
    await userEvent.type(precio, '260')
    await userEvent.click(guardarBtn())
    await waitFor(() => expect(delivery.ponerProductoEnCanales).toHaveBeenCalledExactlyOnceWith('v1', 'p1', { l1: true }))
    expect(svc.updateProduct).toHaveBeenCalledTimes(1)
    expect(svc.updateProduct.mock.calls[0][2]).not.toHaveProperty('venderEn')
    expect(svc.updateProduct.mock.invocationCallOrder[0]).toBeLessThan(delivery.ponerProductoEnCanales.mock.invocationCallOrder[0])
  })
})
