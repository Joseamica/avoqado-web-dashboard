/**
 * D1 · «Vender en» en el asistente de alta: lo marcado viaja con SU envío. Un alta que contesta tarde, después de cerrar y
 * reabrir el asistente, aplica lo que se marcó al enviarla, nunca lo que se marcó en la apertura nueva (Codex plan r2 #7).
 * Arnés copiado de `ProductWizardDialog.session.test.tsx`, más los canales de delivery y el permiso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  getIvaPorProducto: vi.fn(),
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => svc)
const inv = vi.hoisted(() => ({
  productWizardApi: {
    shouldUseInventory: vi.fn(),
    getWizardProgress: vi.fn(),
    createProductWithInventory: vi.fn(),
    configureSimpleStock: vi.fn(),
    configureRecipe: vi.fn(),
  },
  rawMaterialsApi: { getAll: vi.fn() },
  recipesApi: { get: vi.fn(), update: vi.fn(), create: vi.fn() },
  productInventoryApi: { switchInventoryMethod: vi.fn() },
}))
vi.mock('@/services/inventory.service', () => inv)
const delivery = vi.hoisted(() => ({ getChannels: vi.fn(), ponerProductoEnCanales: vi.fn() }))
vi.mock('@/services/delivery.service', () => delivery)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => p === 'delivery-channels:manage' }) }))
const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: http }))
const grupos = vi.hoisted(() => ({ createProductGroup: vi.fn(), listOptionLibrary: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'mi-tienda',
    fullBasePath: '/venues/mi-tienda',
    venue: { id: 'v1', organizationId: 'o1' },
  }),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: false, isResolved: true }) }))
vi.mock('@/firebase', () => ({ storage: {} }))
vi.mock('@/hooks/use-print-stations', () => ({ usePrintStations: () => ({ data: [], isLoading: false }) }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'

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
const diferida = () => {
  let resolve!: (value: any) => void
  const promise = new Promise<any>(si => {
    resolve = si
  })
  return { promise, resolve }
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const onOpenChange = vi.fn()
  const ui = (open: boolean) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog open={open} onOpenChange={onOpenChange} onSuccess={vi.fn()} mode="create" productType="REGULAR" />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true))
  return { abrir: (open: boolean) => rerender(ui(open)) }
}
async function llenarAlta(nombre: string) {
  fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: nombre } })
  await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
  await userEvent.click(await screen.findByRole('option', { name: 'Categoría' }))
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '35' } })
}

beforeEach(() => {
  grupos.listOptionLibrary.mockResolvedValue([])
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Categoría' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.getIvaPorProducto.mockResolvedValue({ encendido: true, bloqueos: [], avisos: [], facturasSinSello: [] })
  inv.productWizardApi.shouldUseInventory.mockResolvedValue({ data: { data: {} } })
  inv.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
  delivery.getChannels.mockResolvedValue([rappi])
  delivery.ponerProductoEnCanales.mockResolvedValue([])
})

describe('asistente de alta: «Vender en» viaja con su envío (D1)', () => {
  it('el alta A, sin Rappi, contesta después de reabrir y marcar Rappi: A se manda en false, nunca en true', async () => {
    const pendiente = diferida()
    inv.productWizardApi.createProductWithInventory.mockReturnValueOnce(pendiente.promise)
    const vista = montar()
    await llenarAlta('Alta A')
    expect(await screen.findByRole('checkbox', { name: 'Rappi' })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(inv.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
    expect(inv.productWizardApi.createProductWithInventory.mock.calls[0][1]).not.toHaveProperty('venderEn')

    vista.abrir(false)
    vista.abrir(true)
    const casilla = await screen.findByRole('checkbox', { name: 'Rappi' })
    expect(casilla).not.toBeChecked()
    await userEvent.click(casilla)
    expect(casilla).toBeChecked()

    await act(async () => {
      pendiente.resolve({ data: { data: { productId: 'A' } } })
      await pendiente.promise
    })
    await waitFor(() => expect(delivery.ponerProductoEnCanales).toHaveBeenCalledWith('v1', 'A', { l1: false }))
    expect(delivery.ponerProductoEnCanales).not.toHaveBeenCalledWith('v1', 'A', { l1: true })
  })
})
