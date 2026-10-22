/** Exact calls observed through the real form before the single-page visual change. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
  const ui = (open: boolean) => <QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ProductWizardDialog open={open} onOpenChange={() => undefined} mode={mode} productType={productType} {...(mode === 'edit' ? { productId: 'p1' } : {})} />
  </MemoryRouter></QueryClientProvider>
  const result = render(ui(true))
  return { ...result, reopen: () => { result.rerender(ui(false)); result.rerender(ui(true)) }, refresh: () => result.rerender(ui(true)) }
}

// After the visual change optional fields may need their public opener; before it, fields already exist.
async function openOptional(section: string) {
  const opener = document.querySelector<HTMLElement>(`[data-tour="product-wizard-add-${section}"]`)
  if (opener) await userEvent.click(opener)
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


const section = (id: string) => document.querySelector(`[data-tour="product-wizard-optional-${id}"]`) as HTMLElement
const opener = (id: string) => document.querySelector(`[data-tour="product-wizard-add-${id}"]`) as HTMLElement
const remove = (id: string) => within(section(id)).getByRole('button', { name: 'wizard.optional.remove' })
const changeValue = (id: string, value: string) => change(document.getElementById(id)!, value)

describe('simple product sections', () => {
  it('starts with only the four core fields and no sidebar preview', async () => {
    mount()
    await screen.findByPlaceholderText('wizard.step1.namePlaceholder')
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toBeVisible()
    expect(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder')).toBeVisible()
    expect(screen.getByText('wizard.step1.dropImage')).toBeVisible()
    for (const id of ['description', 'sku', 'gtin', 'soldByWeight', 'initialStock']) expect(document.getElementById(id)).not.toBeInTheDocument()
    expect(screen.queryByText('wizard.preview.title')).not.toBeInTheDocument()
    expect(document.querySelectorAll('form')).toHaveLength(1)
  })
  it.each([
    ['REGULAR', ['variants', 'inventory', 'codes']], ['OTHER', ['variants', 'inventory', 'codes']],
    ['FOOD_AND_BEV', ['modifiers', 'recipe', 'preparation']], [null, ['modifiers', 'recipe', 'preparation']],
    ['EVENT', ['inventory', 'description']], ['DIGITAL', ['description']], ['DONATION', ['description']],
  ] as const)('orders the recommended options for %s', async (productType, expected) => {
    mount({ productType })
    await waitFor(() => expect(document.querySelector('[data-tour="product-wizard-primary-options"]')).toBeInTheDocument())
    const primary = document.querySelector('[data-tour="product-wizard-primary-options"]')!
    expect(Array.from(primary.querySelectorAll('[data-tour^="product-wizard-add-"]')).map(e => e.getAttribute('data-tour')!.replace('product-wizard-add-', ''))).toEqual(expected)
  })
  it.each([
    ['FOOD_AND_BEV', 'inventory', 'wizard.optional.inventory.title', 'wizard.optional.recipe.title'],
    ['REGULAR', 'recipe', 'wizard.optional.recipe.title', 'wizard.optional.inventory.title'],
  ] as const)('shared inventory header follows the selected method in %s', async (productType, entrance, firstTitle, nextTitle) => {
    mount({ productType })
    await waitFor(() => expect(opener(entrance)).toBeEnabled())
    await openOptional(entrance)
    expect(within(section('inventory')).getByRole('heading', { name: firstTitle })).toBeVisible()
    const other = entrance === 'inventory' ? /wizard\.step2\.recipeBased/ : /wizard\.step2\.quantityTracking/
    await userEvent.click(screen.getByRole('radio', { name: other }))
    expect(within(section('inventory')).getByRole('heading', { name: nextTitle })).toBeVisible()
  })
  it('focuses and scrolls the missing price in a later variant row outside the viewport', async () => {
    mount(); await fillProduct('Camisa'); await openOptional('variants')
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    change(screen.getByLabelText('opciones.nombre'), 'Talla')
    change(screen.getByLabelText('opciones.valores'), Array.from({ length: 12 }, (_, i) => `T${i + 1}`).join(',') + ',')
    change(screen.getByLabelText('tabla.precioTodas'), '199')
    await userEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    const laterPrice = screen.getAllByLabelText('tabla.precio')[10]
    change(laterPrice, '')
    vi.spyOn(laterPrice, 'getBoundingClientRect').mockReturnValue({ top: 1500, bottom: 1548, left: 0, right: 200, width: 200, height: 48, x: 0, y: 1500, toJSON: () => ({}) })
    expect(laterPrice.getBoundingClientRect().top).toBeGreaterThan(window.innerHeight)
    const scroll = vi.spyOn(laterPrice, 'scrollIntoView')
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(laterPrice).toHaveFocus())
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(screen.getAllByLabelText('tabla.precio')[0]).not.toHaveFocus()
    expect(groups.createProductGroup).not.toHaveBeenCalled()
    expect(inventory.productWizardApi.createProductWithInventory).not.toHaveBeenCalled()
  })
  it('focuses the correct variant key when two combinations share the same display name', async () => {
    mount(); await fillProduct('Camisa'); await openOptional('variants')
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    change(screen.getByLabelText('opciones.nombre'), 'Talla')
    change(screen.getByLabelText('opciones.valores'), 'A · B,A,')
    await userEvent.click(screen.getByRole('button', { name: 'opciones.agregar' }))
    change(screen.getAllByLabelText('opciones.nombre')[1], 'Color')
    change(screen.getAllByLabelText('opciones.valores')[1], 'C,B · C,')
    change(screen.getByLabelText('tabla.precioTodas'), '199')
    await userEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    const prices = screen.getAllByLabelText('tabla.precio')
    change(prices[3], '')
    const scroll = vi.spyOn(prices[3], 'scrollIntoView')
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(prices[3]).toHaveFocus())
    expect(prices[0]).not.toHaveFocus()
    expect(prices[0]).toHaveValue(199)
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(groups.createProductGroup).not.toHaveBeenCalled()
  })
  it.each(['create', 'edit'] as const)('focuses and scrolls the actual add-ingredient correction target in %s', async mode => {
    if (mode === 'edit') inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: null } } })
    mount({ mode, productType: 'FOOD_AND_BEV' })
    if (mode === 'create') { await fillProduct(); await waitFor(() => expect(opener('recipe')).toBeEnabled()); await openOptional('recipe') }
    else await screen.findByDisplayValue('Café en grano')
    const add = await screen.findByRole('button', { name: 'recipes.addIngredient' })
    const scroll = vi.spyOn(add, 'scrollIntoView')
    await userEvent.click(screen.getByRole('button', { name: mode === 'edit' ? 'save' : 'wizard.finish' }))
    await waitFor(() => expect(add).toHaveFocus())
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(inventory.productWizardApi.createProductWithInventory).not.toHaveBeenCalled()
    expect(inventory.productWizardApi.configureRecipe).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
  })
  it('opening a blank section is not capture and removal does not ask', async () => {
    mount(); await openOptional('codes')
    await userEvent.click(remove('codes'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(opener('codes')).toBeVisible()
  })
  it('cancel preserves values and confirmed create removal clears only its section', async () => {
    mount(); await fillProduct(); await openOptional('codes'); changeValue('sku', 'ABC')
    await openOptional('description'); changeValue('description', 'Conservar')
    await userEvent.click(remove('codes'))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'cancel' }))
    expect(document.getElementById('sku')).toHaveValue('ABC')
    await userEvent.click(remove('codes'))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'wizard.optional.confirmRemove' }))
    await openOptional('codes'); expect(document.getElementById('sku')).toHaveValue('')
    expect(document.getElementById('description')).toHaveValue('Conservar')
    expect(screen.getByPlaceholderText('wizard.step1.namePlaceholder')).toHaveValue('Libreta')
  })
  it('zero stock counts as capture and removing inventory restores the old off body', async () => {
    mount(); await fillProduct(); await openOptional('inventory'); changeValue('initialStock', '0')
    await userEvent.click(remove('inventory'))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'wizard.optional.confirmRemove' }))
    await saveCreate()
    expect(inventory.productWizardApi.createProductWithInventory.mock.calls[0][1].inventory).toEqual({ useInventory: false })
  })
  it('opens saved fields and a late recipe but never reopens explicitly removed inventory', async () => {
    let resolve!: (v: unknown) => void
    inventory.recipesApi.get.mockReturnValue(new Promise(r => { resolve = r }))
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: null } } })
    const mounted = mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    for (const id of ['codes', 'description', 'modifiers', 'preparation', 'inventory']) expect(section(id)).toBeVisible()
    await waitFor(() => expect(within(section('inventory')).getByRole('button', { name: 'wizard.optional.remove' })).toBeVisible())
    await userEvent.click(remove('inventory'))
    if (screen.queryByRole('alertdialog')) await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'wizard.optional.confirmRemove' }))
    await act(async () => { resolve({ data: { data: { portionYield: 1, lines: [{ rawMaterialId: 'rm1', quantity: 0.1, unit: 'KILOGRAM', rawMaterial: { name: 'Café molido' } }] } } }); await Promise.resolve() })
    mounted.refresh()
    await waitFor(() => expect(opener('recipe')).toBeVisible())
    expect(document.querySelector('[data-tour="product-wizard-recipe-section"]')).not.toBeInTheDocument()
  })
  it('an unchanged server rejection keeps the inventory section and entered core values', async () => {
    inventory.productWizardApi.createProductWithInventory.mockRejectedValue({ response: { status: 400, data: { message: 'Stock inicial requerido' } } })
    mount(); await fillProduct(); await openOptional('inventory')
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(inventory.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
    expect(section('inventory')).toBeVisible()
    expect(screen.getByPlaceholderText('wizard.step1.namePlaceholder')).toHaveValue('Libreta')
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toHaveValue(85)
    expect(screen.getByLabelText(/^wizard\.step3\.initialStock/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'wizard.finish' })).toBeEnabled()
  })
  it('variant toggling and returning preserves quantity stock and the main price', async () => {
    mount(); await fillProduct(); await openOptional('inventory'); changeValue('initialStock', '3'); changeValue('costPerUnit', '12')
    await openOptional('variants')
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    expect(document.getElementById('initialStock')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    expect(document.getElementById('initialStock')).toHaveValue(3)
    expect(document.getElementById('costPerUnit')).toHaveValue(12)
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toHaveValue(85)
  })
  it('removing variants cancels safely and requires the normal price again', async () => {
    mount(); await fillProduct(); await openOptional('variants')
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    change(screen.getByLabelText('opciones.nombre'), 'Talla')
    await userEvent.click(remove('variants'))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'cancel' }))
    expect(screen.getByLabelText('opciones.nombre')).toHaveValue('Talla')
    await userEvent.click(remove('variants'))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'wizard.optional.confirmRemove' }))
    expect(screen.getByLabelText(/^wizard\.step1\.price/)).toHaveValue(85)
    await openOptional('variants')
    expect(screen.getByRole('checkbox', { name: /alta\.casilla/ })).not.toBeChecked()
    expect(screen.queryByLabelText('opciones.nombre')).not.toBeInTheDocument()
  })
  it('late recipe hydration is visible without touching the opener', async () => {
    let resolve!: (v: unknown) => void
    inventory.recipesApi.get.mockReturnValue(new Promise(r => { resolve = r }))
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: null } } })
    mount({ mode: 'edit' }); await screen.findByDisplayValue('Café en grano')
    await act(async () => { resolve({ data: { data: { portionYield: 2, lines: [{ rawMaterialId: 'rm1', quantity: 0.1, unit: 'KILOGRAM', rawMaterial: { name: 'Café molido' } }] } } }); await Promise.resolve() })
    expect(await screen.findByText('Café molido')).toBeVisible()
    expect(section('inventory')).toBeVisible()
  })
  it('CFDI starts open and optional sections reset across openings', async () => {
    access.cfdi = true; const mounted = mount()
    expect(section('fiscal')).toBeVisible()
    await openOptional('codes'); changeValue('sku', 'OLD')
    mounted.reopen(); expect(opener('codes')).toBeVisible(); expect(section('fiscal')).toBeVisible()
  })
  it('edit removal is offered only for inventory and variant parent controls stay disabled', async () => {
    http.get.mockResolvedValue({ data: { data: { ...existingProduct, productGroupId: 'g1', soldByWeight: true } } })
    mount({ mode: 'edit' }); await screen.findByDisplayValue('Café en grano')
    for (const id of ['codes', 'description', 'modifiers', 'preparation', 'weight']) expect(within(section(id)).queryByRole('button', { name: 'wizard.optional.remove' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('wizard.step1.namePlaceholder')).toBeDisabled()
    expect(await screen.findByDisplayValue('Tueste medio')).toBeDisabled()
  })
  it('paid unavailable options stay visible and disabled without bypassing access', async () => {
    access.variants = false; access.inventory = false
    mount({ productType: 'FOOD_AND_BEV' })
    await waitFor(() => expect(opener('recipe')).toBeDisabled())
    expect(screen.getAllByText('wizard.step2.premiumBadge').length).toBeGreaterThan(0)
    expect(opener('variants')).toBeDisabled()
    expect(screen.getByText('alta.casillaBloqueada')).toBeVisible()
  })
  it('does not show preparation when there are no stations', async () => {
    access.stations = false; mount({ productType: 'FOOD_AND_BEV' })
    await screen.findByPlaceholderText('wizard.step1.namePlaceholder')
    expect(opener('preparation')).not.toBeInTheDocument()
  })
  it.each(['APPOINTMENTS_SERVICE', 'CLASS', 'DIGITAL', 'DONATION'] as const)('keeps %s restrictions and type-specific core fields', async productType => {
    mount({ productType }); await screen.findByPlaceholderText('wizard.step1.namePlaceholder')
    expect(opener('inventory')).not.toBeInTheDocument(); expect(opener('modifiers')).not.toBeInTheDocument()
    if (productType === 'CLASS') expect(document.getElementById('maxParticipants')).toBeVisible()
    if (productType === 'APPOINTMENTS_SERVICE') expect(document.getElementById('duration')).toBeVisible()
    if (productType === 'DIGITAL' || productType === 'DONATION') expect(screen.queryByPlaceholderText('wizard.step1.categoryPlaceholder')).not.toBeInTheDocument()
  })
})
