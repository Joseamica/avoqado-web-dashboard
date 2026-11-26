// hz:960ee149:D1: el dueño acomoda los grupos de modificadores del producto con «Subir» y «Bajar». El orden de la lista es el
// orden en que salen en la caja, y al guardar viaja en `modifierGroupIds`.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const menu = vi.hoisted(() => ({
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  getIvaPorProducto: vi.fn(),
  IVA_QUERY_KEY: (venueId: string) => ['iva-por-producto', venueId] as const,
}))
vi.mock('@/services/menu.service', () => menu)
const inventory = vi.hoisted(() => ({
  productWizardApi: {
    shouldUseInventory: vi.fn(),
    getWizardProgress: vi.fn(),
    createProductWithInventory: vi.fn(),
    configureSimpleStock: vi.fn(),
    configureRecipe: vi.fn(),
  },
  rawMaterialsApi: { getAll: vi.fn() },
  recipesApi: { get: vi.fn(), update: vi.fn() },
  productInventoryApi: { switchInventoryMethod: vi.fn() },
}))
vi.mock('@/services/inventory.service', () => inventory)
const groups = vi.hoisted(() => ({ createProductGroup: vi.fn(), listOptionLibrary: vi.fn() }))
vi.mock('@/services/productGroups.service', () => groups)
const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: http }))
vi.mock('@/services/cfdi.service', () => ({ cfdiService: { searchSatCatalog: async () => [] } }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'mi-tienda',
    fullBasePath: '/venues/mi-tienda',
    venue: { id: 'v1', organizationId: 'o1' },
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: true, isResolved: true, isLoading: false, requiredTier: 'PRO' }),
}))
vi.mock('@/hooks/use-print-stations', () => ({ usePrintStations: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (key: string) => key }) }))
vi.mock('@/hooks/use-image-uploader', () => {
  const uploader = {
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    onCropComplete: () => undefined,
    handleFileUpload: () => undefined,
    handleCropConfirm: () => undefined,
    handleFileRemove: () => undefined,
    resetImage: () => undefined,
    setImageForCrop: () => undefined,
    setCrop: () => undefined,
    setZoom: () => undefined,
  }
  return { useImageUploader: () => uploader }
})
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
// La clave más el nombre: así cada botón de «Subir»/«Bajar» se distingue por grupo.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key} ${opts.name}` : key),
    i18n: { language: 'es-MX' },
  }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'

type Fila = { id: string; name: string; displayOrder: number }
const BEBIDA: Fila = { id: 'g1', name: 'Bebida', displayOrder: 0 }
const GUARNICION: Fila = { id: 'g2', name: 'Guarnición', displayOrder: 1 }
const SALSA: Fila = { id: 'g3', name: 'Salsa', displayOrder: 2 }

function producto(filas: Fila[], extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Combo',
    price: 120,
    type: 'REGULAR',
    categoryId: 'c1',
    soldByWeight: false,
    modifierGroups: filas.map(f => ({ groupId: f.id, displayOrder: f.displayOrder, group: { id: f.id, name: f.name } })),
    ...extra,
  }
}

// Abre el producto guardado y espera a que cargue (el nombre y los grupos llegan juntos).
async function mount(filas: Fila[], extra: Record<string, unknown> = {}) {
  http.get.mockResolvedValue({ data: { data: producto(filas, extra) } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog open onOpenChange={() => undefined} mode="edit" productType="REGULAR" productId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByDisplayValue('Combo', {}, ESPERA)
}

// Con la Mac cargada el formulario tarda más que el segundo por defecto de `waitFor`.
const ESPERA = { timeout: 10_000 }
const SUBIR = 'wizard.step1.moveGroupUp'
const BAJAR = 'wizard.step1.moveGroupDown'
const HINT = 'wizard.step1.modifierGroupsOrderHint'
const boton = (accion: string, nombre: string) => screen.getByRole('button', { name: `${accion} ${nombre}` })
// El orden en pantalla, leído de los botones «Subir» de cada fila.
const ordenEnPantalla = () =>
  screen.getAllByRole('button', { name: new RegExp(`^${SUBIR} `) }).map(b => b.getAttribute('aria-label')!.slice(SUBIR.length + 1))

beforeEach(() => {
  menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'General' }])
  menu.getModifierGroups.mockResolvedValue([BEBIDA, GUARNICION, SALSA].map(f => ({ id: f.id, name: f.name, modifiers: [] })))
  menu.getIvaPorProducto.mockResolvedValue({
    encendido: true,
    habilitadoAt: null,
    contabilidad: false,
    bloqueos: [],
    avisos: [],
    facturasSinSello: [],
  })
  inventory.productWizardApi.shouldUseInventory.mockResolvedValue({ data: { data: { hasInventoryFeature: true } } })
  inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
  inventory.rawMaterialsApi.getAll.mockResolvedValue({ data: { data: [] } })
  inventory.recipesApi.get.mockResolvedValue({ data: { data: null } })
  groups.listOptionLibrary.mockResolvedValue([])
  http.put.mockResolvedValue({ data: {} })
})

describe('ProductWizardDialog: orden de los grupos de modificadores (hz:960ee149:D1)', { timeout: 20_000 }, () => {
  it('«Bajar» mueve el grupo una posición y al guardar viaja el orden nuevo', async () => {
    await mount([BEBIDA, GUARNICION, SALSA])
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bebida', 'Guarnición', 'Salsa']), ESPERA)

    await userEvent.click(boton(BAJAR, 'Bebida'))
    expect(ordenEnPantalla()).toEqual(['Guarnición', 'Bebida', 'Salsa'])

    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1), ESPERA)
    expect(http.put.mock.calls[0][1].modifierGroupIds).toEqual(['g2', 'g1', 'g3'])
  })

  it('«Subir» mueve el grupo una posición arriba', async () => {
    await mount([BEBIDA, GUARNICION, SALSA])
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bebida', 'Guarnición', 'Salsa']), ESPERA)
    await userEvent.click(boton(SUBIR, 'Salsa'))
    expect(ordenEnPantalla()).toEqual(['Bebida', 'Salsa', 'Guarnición'])
  })

  it('«Subir» está en gris en la primera fila y «Bajar» en la última', async () => {
    await mount([BEBIDA, GUARNICION, SALSA])
    await waitFor(() => expect(ordenEnPantalla()).toHaveLength(3), ESPERA)
    expect(boton(SUBIR, 'Bebida')).toBeDisabled()
    expect(boton(BAJAR, 'Bebida')).toBeEnabled()
    expect(boton(SUBIR, 'Guarnición')).toBeEnabled()
    expect(boton(BAJAR, 'Guarnición')).toBeEnabled()
    expect(boton(SUBIR, 'Salsa')).toBeEnabled()
    expect(boton(BAJAR, 'Salsa')).toBeDisabled()
  })

  it('con un solo grupo no sale la línea de ayuda del orden', async () => {
    await mount([BEBIDA])
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bebida']), ESPERA)
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })

  it('con dos grupos sale la línea de ayuda del orden', async () => {
    await mount([BEBIDA, GUARNICION])
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bebida', 'Guarnición']), ESPERA)
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it('un producto guardado enseña sus grupos por displayOrder, no por cómo llegan', async () => {
    await mount([SALSA, BEBIDA, GUARNICION]) // displayOrder 2, 0, 1
    await waitFor(() => expect(ordenEnPantalla()).toEqual(['Bebida', 'Guarnición', 'Salsa']), ESPERA)
  })

  it('en una variante «Subir» y «Bajar» están en gris, igual que quitar', async () => {
    await mount([BEBIDA, GUARNICION, SALSA], { productGroupId: 'fam1', productGroupName: 'Familia' })
    await waitFor(() => expect(ordenEnPantalla()).toHaveLength(3), ESPERA)
    expect(boton(BAJAR, 'Bebida')).toBeDisabled()
    expect(boton(SUBIR, 'Guarnición')).toBeDisabled()
    expect(boton(BAJAR, 'Guarnición')).toBeDisabled()
  })
})
