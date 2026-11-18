/**
 * Tarjeta `hz:nube0000:na1d52b5` (17-nov-2026): «Nuevo producto» deja contar piezas en todos los planes (founder, 29-sep, «B»).
 * Antes: sin Premium, la sección «Inventario» no se abría y, si la recomendación del SERVIDOR fallaba (403 en Gratis/Pro), decía
 * «Cargando…» para siempre. Editar las piezas de un producto que ya existe sigue siendo Premium (Codex r1 de na1d52b5).
 * El armado (mocks y ayudantes) es el de `ProductWizardDialog.sections.test.tsx`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'

configure({ asyncUtilTimeout: 5000 })

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
const fiscal = vi.hoisted(() => ({ searchSatCatalog: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({ cfdiService: fiscal }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'v1',
    venueSlug: 'mi-tienda',
    fullBasePath: '/venues/mi-tienda',
    venue: { id: 'v1', organizationId: 'o1' },
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
const access = vi.hoisted(() => ({ cfdi: false, variants: true, inventory: true, resolved: true, stations: true }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: (code: string) => ({
    hasAccess: code === 'CFDI' ? access.cfdi : code === 'PRODUCT_VARIANTS' ? access.variants : access.inventory,
    isResolved: access.resolved,
    isLoading: false,
    requiredTier: 'PRO',
  }),
}))
vi.mock('@/hooks/use-print-stations', () => ({
  usePrintStations: () => ({ data: access.stations ? [{ id: 'station1', name: 'Empaque', active: true }] : [], isLoading: false }),
}))
vi.mock('@/hooks/use-terminology', () => ({ useTerminology: () => ({ term: (key: string) => key }) }))
// Stable functions mirror the uploader's setters; vi.fn implementations are reset by Vitest.
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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-MX' } }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'
import type { ProductType } from '@/services/inventory.service'

const existingProduct = {
  id: 'p1',
  name: 'Café en grano',
  description: 'Tueste medio',
  price: 250,
  type: 'REGULAR',
  categoryId: 'c1',
  imageUrl: 'https://cdn.example.com/cafe.jpg',
  sku: 'CAFE-001',
  gtin: '7501234567893',
  soldByWeight: false,
  modifierGroups: [{ groupId: 'm1', group: { id: 'm1', name: 'Empaque de regalo' } }],
  printStationId: 'station1',
  satProductKey: '50201706',
  satUnitKey: 'H87',
  ivaTratamiento: 'IVA_16',
}
const rawMaterials = [
  { id: 'rm1', name: 'Café molido', unit: 'KILOGRAM', category: 'BEVERAGES', costPerUnit: 200, currentStock: 10 },
  { id: 'rm2', name: 'Leche', unit: 'LITER', category: 'DAIRY', costPerUnit: 30, currentStock: 20 },
]

function mount({ mode = 'create', productType = 'REGULAR' }: { mode?: 'create' | 'edit'; productType?: ProductType | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog
          open={open}
          onOpenChange={() => undefined}
          mode={mode}
          productType={productType}
          {...(mode === 'edit' ? { productId: 'p1' } : {})}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(ui(true))
  return {
    ...result,
    reopen: () => {
      result.rerender(ui(false))
      result.rerender(ui(true))
    },
    refresh: () => result.rerender(ui(true)),
  }
}

function change(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } })
}
async function fillProduct(name = 'Libreta', price = '85', category = true) {
  change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), name)
  change(screen.getByLabelText(/^wizard\.step1\.price/), price)
  if (category) {
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'General' }))
  }
}
async function saveCreate() {
  await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
  await waitFor(() => expect(inventory.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
  expect(groups.createProductGroup).not.toHaveBeenCalled()
  expect(http.put).not.toHaveBeenCalled()
  return inventory.productWizardApi.createProductWithInventory.mock.calls
}
beforeEach(() => {
  access.cfdi = false
  access.variants = true
  access.inventory = true
  access.resolved = true
  access.stations = true
  menu.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'General' }])
  menu.getModifierGroups.mockResolvedValue([{ id: 'm1', name: 'Empaque de regalo', modifiers: [] }])
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
  inventory.productWizardApi.createProductWithInventory.mockResolvedValue({ data: { data: { productId: 'p9' } } })
  inventory.productWizardApi.configureSimpleStock.mockResolvedValue({})
  inventory.productWizardApi.configureRecipe.mockResolvedValue({})
  inventory.rawMaterialsApi.getAll.mockResolvedValue({ data: { data: rawMaterials } })
  inventory.recipesApi.get.mockResolvedValue({ data: { data: null } })
  inventory.recipesApi.update.mockResolvedValue({})
  groups.listOptionLibrary.mockResolvedValue([])
  groups.createProductGroup.mockResolvedValue({ groupId: 'g1', productIds: ['p1', 'p2'], categoryId: 'c1' })
  http.get.mockResolvedValue({ data: { data: existingProduct } })
  http.put.mockResolvedValue({ data: {} })
  fiscal.searchSatCatalog.mockImplementation(async (_venue, type) =>
    type === 'product' ? [{ key: '53121603', description: 'Bolsas' }] : [{ key: 'H87', description: 'Pieza' }],
  )
})

const opener = (id: string) => document.querySelector(`[data-tour="product-wizard-add-${id}"]`) as HTMLElement
const changeValue = (id: string, value: string) => change(document.getElementById(id)!, value)

const RECOMENDACION_SIN_PREMIUM = {
  hasInventoryFeature: false,
  recommendation: 'wizard.step2.recommendationDisabled',
  options: [
    { type: 'NONE', enabled: true },
    { type: 'QUANTITY', enabled: true },
    { type: 'RECIPE', enabled: false },
  ],
}

// El asistente es pesado (formulario completo + combobox): con la Mac cargada rozaba los 5 s por defecto.
describe('na1d52b5 · contar piezas al dar de alta en todos los planes', { timeout: 20_000 }, () => {
  beforeEach(() => {
    access.inventory = false // Gratis o Pro: sin INVENTORY_TRACKING
    inventory.productWizardApi.shouldUseInventory.mockResolvedValue({ data: { data: RECOMENDACION_SIN_PREMIUM } })
  })

  // NEW FEATURE TESTS
  it('Gratis/Pro: «Inventario» se abre, se escriben las piezas y el alta viaja por piezas', async () => {
    mount({ productType: 'REGULAR' })
    await fillProduct()
    await waitFor(() => expect(opener('inventory')).toBeEnabled())
    await userEvent.click(opener('inventory'))
    changeValue('initialStock', '10')
    changeValue('costPerUnit', '5')
    const calls = await saveCreate()
    expect(calls[0][1].inventory).toMatchObject({ useInventory: true, inventoryMethod: 'QUANTITY' })
    expect(calls[0][1].simpleStock).toMatchObject({ initialStock: 10, costPerUnit: 5 })
  })

  it('Gratis/Pro: la receta sigue cerrada con su etiqueta Premium', async () => {
    mount({ productType: 'FOOD_AND_BEV' })
    await waitFor(() => expect(opener('recipe')).toBeDisabled())
    expect(screen.getAllByText('wizard.step2.premiumBadge').length).toBeGreaterThan(0)
  })

  it('si la recomendación falla (tras su reintento), la sección dice que no se pudo revisar (no «Cargando…» para siempre)', async () => {
    inventory.productWizardApi.shouldUseInventory.mockRejectedValue({ response: { status: 500 } })
    mount({ productType: 'REGULAR' })
    await waitFor(() => expect(opener('inventory')).toHaveTextContent('wizard.step2.recommendationError'), { timeout: 5_000 })
    expect(opener('inventory')).toBeDisabled()
    expect(opener('inventory')).not.toHaveTextContent('loading')
    expect(inventory.productWizardApi.shouldUseInventory).toHaveBeenCalledTimes(2) // un reintento y ya (Codex r4 #8)
  })

  it('sin permiso de inventario (403, p. ej. marca blanca sin Inventario): lo dice, en vez de culpar al plan', async () => {
    inventory.productWizardApi.shouldUseInventory.mockRejectedValue({ response: { status: 403 } })
    mount({ productType: 'REGULAR' })
    await waitFor(() => expect(opener('inventory')).toHaveTextContent('wizard.step2.recommendationNoAccess'), { timeout: 5_000 })
    expect(opener('inventory')).toBeDisabled()
  })

  it('marca blanca o exento: el cálculo del panel dice «sin Premium» pero el SERVIDOR dice que sí: la receta se abre (Codex r4 #6)', async () => {
    access.inventory = false
    inventory.productWizardApi.shouldUseInventory.mockResolvedValue({
      data: { data: { hasInventoryFeature: true, recommendation: 'wizard.step2.recommendationEnabled' } },
    })
    mount({ productType: 'FOOD_AND_BEV' })
    await waitFor(() => expect(opener('recipe')).toBeEnabled())
  })

  it('al volver a abrir no usa la respuesta de la apertura anterior: espera la nueva (Codex r4 #4)', async () => {
    const asistente = mount({ productType: 'FOOD_AND_BEV' })
    await waitFor(() => expect(opener('recipe')).toBeDisabled()) // primera apertura: sin Premium
    let soltar!: (v: unknown) => void
    inventory.productWizardApi.shouldUseInventory.mockReturnValue(new Promise(r => (soltar = r)))
    asistente.reopen() // mientras tanto el negocio subió a Premium
    await waitFor(() => expect(opener('inventory')).toHaveTextContent('loading'))
    soltar({ data: { data: { hasInventoryFeature: true, recommendation: 'wizard.step2.recommendationEnabled' } } })
    await waitFor(() => expect(opener('recipe')).toBeEnabled())
  })

  it('sin internet la consulta se pausa: tampoco se queda en «Cargando…» (Codex r2 #6)', async () => {
    onlineManager.setOnline(false)
    try {
      mount({ productType: 'REGULAR' })
      await waitFor(() => expect(opener('inventory')).toHaveTextContent('wizard.step2.recommendationError'))
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('el panel dice «con Premium» (plan sin cargar, marca blanca) pero el SERVIDOR dice que no: la receta sigue cerrada (Codex r2 #5)', async () => {
    access.inventory = true // el cálculo del panel falla abierto
    mount({ productType: 'REGULAR' })
    await fillProduct()
    await waitFor(() => expect(opener('inventory')).toBeEnabled())
    await userEvent.click(opener('inventory'))
    expect(document.getElementById('recipe-based-left')).toBeDisabled()
  })

  it('editar un producto en Gratis/Pro: las piezas siguen siendo Premium y lo dice (no se ofrece algo que fallaría)', async () => {
    inventory.productWizardApi.getWizardProgress.mockRejectedValue({ response: { status: 403 } })
    inventory.recipesApi.get.mockRejectedValue({ response: { status: 403 } })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await waitFor(() => expect(opener('inventory')).toHaveTextContent('wizard.step2.editQuantityPremium'))
    expect(opener('inventory')).toBeDisabled()
  })

  // REGRESSION TESTS
  it('SERVIDOR viejo (sin piezas habilitadas para Gratis/Pro): queda como hoy, cerrada con el texto del SERVIDOR', async () => {
    inventory.productWizardApi.shouldUseInventory.mockResolvedValue({
      data: {
        data: { ...RECOMENDACION_SIN_PREMIUM, options: RECOMENDACION_SIN_PREMIUM.options.map(o => ({ ...o, enabled: o.type === 'NONE' })) },
      },
    })
    mount({ productType: 'REGULAR' })
    await waitFor(() => expect(opener('inventory')).toHaveTextContent('wizard.step2.recommendationDisabled'))
    expect(opener('inventory')).toBeDisabled()
  })

  it('Premium: se abre como siempre', async () => {
    access.inventory = true
    inventory.productWizardApi.shouldUseInventory.mockResolvedValue({
      data: { data: { hasInventoryFeature: true, recommendation: 'wizard.step2.recommendationEnabled' } },
    })
    mount({ productType: 'REGULAR' })
    await fillProduct()
    await waitFor(() => expect(opener('inventory')).toBeEnabled())
  })
})
