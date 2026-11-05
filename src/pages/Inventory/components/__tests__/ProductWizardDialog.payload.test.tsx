/** Exact calls observed through the real form before the single-page visual change. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const toast = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const access = vi.hoisted(() => ({ cfdi: false }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: (code: string) => ({
    hasAccess: code === 'CFDI' ? access.cfdi : true,
    isResolved: true,
    isLoading: false,
    requiredTier: 'PRO',
  }),
}))
vi.mock('@/hooks/use-print-stations', () => ({
  usePrintStations: () => ({ data: [{ id: 'station1', name: 'Empaque', active: true }], isLoading: false }),
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

function mount({ mode = 'create', productType = 'REGULAR' }: { mode?: 'create' | 'edit'; productType?: ProductType } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog
          open
          onOpenChange={() => undefined}
          mode={mode}
          productType={productType}
          {...(mode === 'edit' ? { productId: 'p1' } : {})}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// After the visual change optional fields may need their public opener; before it, fields already exist.
async function openOptional(section: string) {
  const opener = document.querySelector<HTMLElement>(`[data-tour="product-wizard-add-${section}"]`)
  if (opener) {
    await waitFor(() => expect(opener).toBeEnabled())
    await userEvent.click(opener)
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
async function enableInventory() {
  await openOptional('inventory')
  await waitFor(() => expect(screen.getByRole('radio', { name: /wizard\.step2\.quantityTracking/ })).toBeChecked())
}
async function addIngredient(name: string, quantity: string, optional = false) {
  await userEvent.click(document.querySelector('[data-tour="product-wizard-add-ingredient"]') as HTMLElement)
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
  change(screen.getByLabelText(/^recipes\.ingredients\.quantity/), quantity)
  if (optional) {
    await userEvent.click(screen.getByRole('checkbox', { name: 'recipes.ingredients.optional' }))
    change(screen.getByLabelText('recipes.ingredients.substituteNotes'), 'Puede ser vegetal')
  }
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  await waitFor(() => expect(screen.queryByLabelText(/^recipes\.ingredients\.quantity/)).not.toBeInTheDocument())
}

beforeEach(() => {
  access.cfdi = false
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

describe('ProductWizardDialog: observed request contracts before the visual move', () => {
  it('creates a regular product with only name, price and category', async () => {
    mount()
    await fillProduct()
    expect(await saveCreate()).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "inventory": {
              "useInventory": false,
            },
            "product": {
              "categoryId": "c1",
              "description": "",
              "modifierGroupIds": [],
              "name": "Libreta",
              "price": 85,
              "printStationId": null,
              "soldByWeight": false,
              "type": "REGULAR",
            },
          },
        ],
      ]
    `)
  })

  it('creates quantity stock, including an explicitly entered zero', async () => {
    mount()
    await fillProduct('Vaso', '55')
    await enableInventory()
    change(screen.getByLabelText(/^wizard\.step3\.initialStock/), '0')
    change(screen.getByLabelText(/^wizard\.step3\.costPerUnit/), '12.5')
    change(screen.getByLabelText(/^wizard\.step3\.reorderPoint/), '4')
    expect(await saveCreate()).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "inventory": {
              "inventoryMethod": "QUANTITY",
              "useInventory": true,
            },
            "product": {
              "categoryId": "c1",
              "description": "",
              "modifierGroupIds": [],
              "name": "Vaso",
              "price": 55,
              "printStationId": null,
              "soldByWeight": false,
              "type": "REGULAR",
            },
            "simpleStock": {
              "costPerUnit": 12.5,
              "initialStock": 0,
              "reorderPoint": 4,
              "unit": "UNIT",
            },
          },
        ],
      ]
    `)
  })

  it('creates a recipe with two ingredients and the optional recipe details', async () => {
    mount({ productType: 'FOOD_AND_BEV' })
    await fillProduct('Café con leche', '45')
    await enableInventory()
    await userEvent.click(screen.getByRole('radio', { name: /wizard\.step2\.recipeBased/ }))
    change(screen.getByLabelText(/^recipes\.fields\.portionYield/), '2')
    await userEvent.click(screen.getByRole('button', { name: 'common:advancedOptions' }))
    change(screen.getByLabelText('recipes.fields.prepTime'), '5')
    change(screen.getByLabelText('recipes.fields.cookTime'), '3')
    change(screen.getByLabelText('recipes.fields.notes'), 'Servir caliente')
    await addIngredient('Café molido', '0.04')
    await addIngredient('Leche', '0.3', true)
    expect(await saveCreate()).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "inventory": {
              "inventoryMethod": "RECIPE",
              "useInventory": true,
            },
            "product": {
              "categoryId": "c1",
              "description": "",
              "modifierGroupIds": [],
              "name": "Café con leche",
              "price": 45,
              "printStationId": null,
              "soldByWeight": false,
              "type": "FOOD_AND_BEV",
            },
            "recipe": {
              "cookTime": 3,
              "ingredients": [
                {
                  "isOptional": false,
                  "quantity": 0.04,
                  "rawMaterialId": "rm1",
                  "unit": "KILOGRAM",
                },
                {
                  "isOptional": true,
                  "quantity": 0.3,
                  "rawMaterialId": "rm2",
                  "substituteNotes": "Puede ser vegetal",
                  "unit": "LITER",
                },
              ],
              "notes": "Servir caliente",
              "portionYield": 2,
              "prepTime": 5,
            },
          },
        ],
      ]
    `)
  }, 20000)

  it('sends trimmed codes and kilogram units for weight sales', async () => {
    mount()
    await fillProduct('Nuez a granel', '320')
    await openOptional('codes')
    change(screen.getByLabelText(/^SKU/), '  NUEZ-01  ')
    change(screen.getByLabelText(/^GTIN/), '  7501234567893  ')
    await openOptional('weight')
    await userEvent.click(screen.getByRole('switch', { name: 'wizard.step1.soldByWeight' }))
    expect(await saveCreate()).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "inventory": {
              "useInventory": false,
            },
            "product": {
              "categoryId": "c1",
              "description": "",
              "gtin": "7501234567893",
              "modifierGroupIds": [],
              "name": "Nuez a granel",
              "price": 320,
              "printStationId": null,
              "sku": "NUEZ-01",
              "soldByWeight": true,
              "type": "REGULAR",
              "unit": "KILOGRAM",
            },
          },
        ],
      ]
    `)
  })

  it('sends description, modifier, print station and CFDI choices', async () => {
    access.cfdi = true
    mount()
    await fillProduct('Bolsa de regalo', '50')
    await openOptional('description')
    change(screen.getByPlaceholderText('wizard.step1.descriptionPlaceholder'), 'Papel reciclado')
    await openOptional('modifiers')
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.selectModifierGroups'))
    await userEvent.click(await screen.findByRole('option', { name: 'Empaque de regalo' }))
    await openOptional('preparation')
    await userEvent.click(within(document.querySelector('[data-tour="print-station-field"]') as HTMLElement).getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'Empaque' }))
    const sat = within(document.querySelector('[data-tour="product-sat-keys"]') as HTMLElement)
    await userEvent.click(sat.getAllByRole('combobox')[0])
    await userEvent.click(await screen.findByRole('option', { name: /53121603/ }))
    await userEvent.click(sat.getAllByRole('combobox')[1])
    await userEvent.click(await screen.findByRole('option', { name: /H87/ }))
    expect(await saveCreate()).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "inventory": {
              "useInventory": false,
            },
            "product": {
              "categoryId": "c1",
              "description": "Papel reciclado",
              "modifierGroupIds": [
                "m1",
              ],
              "name": "Bolsa de regalo",
              "price": 50,
              "printStationId": "station1",
              "satProductKey": "53121603",
              "satUnitKey": "H87",
              "soldByWeight": false,
              "type": "REGULAR",
            },
          },
        ],
      ]
    `)
  })

  it('edits an unchanged product without inventing an IVA change', async () => {
    access.cfdi = true
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "/api/v1/dashboard/venues/v1/products/p1",
          {
            "categoryId": "c1",
            "description": "Tueste medio",
            "gtin": "7501234567893",
            "imageUrl": "https://cdn.example.com/cafe.jpg",
            "modifierGroupIds": [
              "m1",
            ],
            "name": "Café en grano",
            "price": 250,
            "printStationId": "station1",
            "satProductKey": "50201706",
            "satUnitKey": "H87",
            "sku": "CAFE-001",
            "soldByWeight": false,
            "trackInventory": false,
          },
        ],
      ]
    `)
    expect(inventory.productWizardApi.createProductWithInventory).not.toHaveBeenCalled()
  })

  const conStock = (details: Record<string, unknown> = {}) => ({
    data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 7, minimumStock: 3, reservedStock: 0, costPerUnit: 20, ...details } } },
  })

  // D7: abres con 7, se venden 2 (quedan 5) y guardas un cambio de nombre. Reenviar el 7 que se leyó al abrir regresaba las
  // existencias a 7, porque el SERVIDOR las escribe como número absoluto y anota la diferencia como ajuste.
  it('saving only the product never resends the stock it read when opening', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[0][1]).toMatchObject({ name: 'Café en grano', price: 250 })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  // Codex r1: el asistente enseña el inventario de un producto con el método puesto y el seguimiento apagado (la app móvil lo deja así).
  // Guardar lo prende, como siempre; las existencias van las de este momento.
  it('saving a product with tracking off turns it on keeping the stock of this moment', async () => {
    http.get.mockResolvedValue({ data: { data: { ...existingProduct, trackInventory: false } } })
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: 5 }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[1]).toEqual(['/api/v1/dashboard/venues/v1/products/p1', { inventoryMethod: 'QUANTITY', trackInventory: true }])
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls[0][2]).toMatchObject({ initialStock: 5 })
  })

  it('with tracking off and no cost, saving still changes only the product', async () => {
    http.get.mockResolvedValue({ data: { data: { ...existingProduct, trackInventory: false } } })
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ costPerUnit: 0 }))
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'wizard.step3.costPerUnitMinimum' }))
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  // Codex r2: el intento fallido de pasar a receta pudo dejar el método cambiado en el SERVIDOR; volver a «Por cantidad» debe reescribirlo.
  it('after a failed switch to recipe, going back to quantity configures it again', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    inventory.recipesApi.update.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Falló la receta' } } })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    await userEvent.click(screen.getByRole('radio', { name: /wizard\.step2\.recipeBased/ }))
    await addIngredient('Café molido', '0.04')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Falló la receta' })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    await userEvent.click(screen.getByRole('radio', { name: /wizard\.step2\.quantityTracking/ }))
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: 5 }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[http.put.mock.calls.length - 1]).toEqual(['/api/v1/dashboard/venues/v1/products/p1', { inventoryMethod: 'QUANTITY', trackInventory: true }])
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls[0][2]).toMatchObject({ initialStock: 5 })
  })

  // Otro aparato cambió el método con la ventana abierta y la lectura se refrescó: sin tocar nada no se le regresa, ni se borra su receta.
  it('if the method changed elsewhere while open, saving only the product does not switch it back', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProductWizardDialog open onOpenChange={() => undefined} mode="edit" productType="REGULAR" productId="p1" />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: { recipeId: 'r1' } } } })
    await act(async () => { await client.refetchQueries({ queryKey: ['product-wizard-progress', 'v1', 'p1'] }) })
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  // Codex r3: una relectura sin saldo (otro aparato apagó el seguimiento en ese instante) nunca se vuelve un cero.
  it('a re-read without a stock keeps the captured number instead of writing zero', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    change(screen.getByLabelText(/^wizard\.step3\.costPerUnit/), '30')
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls[0][2]).toMatchObject({ initialStock: 7, costPerUnit: 30 })
  })

  // Codex r3: tras un envío que falló, un número que el usuario escribió sigue mandando aunque coincida con el de la apertura.
  it.each([
    ['corrects back to the original number', '7', 7],
    ['retries the number it typed', '9', 9],
  ])('after a failed stock save, a user who %s gets that number', async (_caso, segundo, esperado) => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    inventory.productWizardApi.configureSimpleStock.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Sin respuesta' } } })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    const existencias = await screen.findByDisplayValue('7')
    change(existencias, '9')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Sin respuesta' })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    change(existencias, segundo)
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: esperado === 7 ? 9 : 7 })) // el SERVIDOR quedó distinto
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(2))
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls[1][2]).toMatchObject({ initialStock: esperado })
  })

  // Codex r3: el PUT que apaga el inventario pudo aplicarse aunque contestara error; al volver a agregarlo hay que prenderlo de nuevo.
  it('after a failed removal of inventory, adding it back turns tracking on again', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    const seccion = () => document.querySelector('[data-tour="product-wizard-optional-inventory"]') as HTMLElement
    await userEvent.click(within(seccion()).getByRole('button', { name: 'wizard.optional.remove' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'wizard.optional.confirmRemove' }))
    http.put.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Sin respuesta' } } })
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Sin respuesta' })))
    await openOptional('inventory')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[http.put.mock.calls.length - 1]).toEqual(['/api/v1/dashboard/venues/v1/products/p1', { inventoryMethod: 'QUANTITY', trackInventory: true }])
  })

  it('typing and restoring the same stock is not a change', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    const existencias = await screen.findByDisplayValue('7')
    change(existencias, '9')
    change(existencias, '7')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  it('a stock the user typed is sent as typed through both product PUTs and the stock service', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    change(await screen.findByDisplayValue('7'), '9')
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: 5 })) // lo que escribió manda
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[1]).toEqual(['/api/v1/dashboard/venues/v1/products/p1', { inventoryMethod: 'QUANTITY', trackInventory: true }])
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls).toEqual([
      ['v1', 'p1', { costPerUnit: 20, initialStock: 9, reorderPoint: 3, unit: 'UNIT' }],
    ])
  })

  // El SERVIDOR sólo cambia mínimo y costo por la misma ruta de las existencias, y ésa las exige. Si nadie las tocó, va el saldo de
  // este momento. 10 es, además, el valor inicial del formulario: `dirtyFields` no vería el cambio de 3 a 10.
  it.each([
    ['minimum', /^wizard\.step3\.reorderPoint/, '10', { reorderPoint: 10, costPerUnit: 20 }],
    ['cost', /^wizard\.step3\.costPerUnit/, '30', { reorderPoint: 3, costPerUnit: 30 }],
  ])('changing only the %s sends the stock of this moment, not the one read when opening', async (_campo, etiqueta, valor, esperado) => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    change(screen.getByLabelText(etiqueta), valor)
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: 5 }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls[0][2]).toMatchObject({ initialStock: 5, ...esperado })
  })

  it('if the stock of this moment cannot be read, nothing is written over it', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    change(screen.getByLabelText(/^wizard\.step3\.reorderPoint/), '6')
    inventory.productWizardApi.getWizardProgress.mockRejectedValue({ response: { status: 500, data: { message: 'Sin lectura' } } })
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Sin lectura', variant: 'destructive' })))
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  // Venta por peso: las existencias llevan 3 decimales. `step="0.01"` frenaba «Guardar», también en un cambio de nombre.
  it.each([
    ['already saved', async () => undefined],
    ['typed', async () => change(screen.getByLabelText(/^wizard\.step3\.initialStock/), '2.375')],
  ])('a stock with 3 decimals %s does not stop the save', async (_caso, accion) => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock({ currentStock: 1.125 }))
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('1.125')
    await accion()
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalled())
  })

  // D8: ninguna columna guarda un umbral por producto; lo que avisa es el mínimo (cantidad) o 5 porciones (receta).
  it('does not offer a per-product low stock threshold that nothing saves', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock())
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('7')
    expect(screen.queryByLabelText('lowStockThreshold.label')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^wizard\.step3\.reorderPoint/)).toBeInTheDocument()
  })

  // Un producto por cantidad puede no tener costo. El campo salía en 0, el mínimo del navegador frenaba «Guardar» y el servidor
  // tampoco acepta costo 0: no se podía cambiar nada del producto (D2).
  it.each([0, null])('saves a change to a product whose cost is %s without touching its stock', async costPerUnit => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 7, minimumStock: 3, reservedStock: 0, costPerUnit } } },
    })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    expect(screen.getByLabelText(/wizard\.step3\.costPerUnit/)).toHaveValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls[0][1]).toMatchObject({ name: 'Café en grano', price: 250 })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  it('asks for the cost before saving a stock change on a product without one', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 7, minimumStock: 3, reservedStock: 0, costPerUnit: 0 } } },
    })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    change(await screen.findByDisplayValue('7'), '9')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(http.put).not.toHaveBeenCalled()
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'wizard.step3.costPerUnitMinimum' }))
  })

  // El SERVIDOR manda `minimumStock`: leer `reorderPoint` llenaba el campo con 10 y guardar pisaba el mínimo real (D3).
  // 0 es un mínimo válido, y un decimal (venta por peso) no debe frenar «Guardar» por el `step` del campo.
  it.each([0, 3, 2.5])('shows a saved minimum of %s and leaves it alone when saving without touching it', async minimumStock => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 7, minimumStock, reservedStock: 0, costPerUnit: 20 } } },
    })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    expect(screen.getByLabelText(/^wizard\.step3\.reorderPoint/)).toHaveValue(minimumStock)
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(inventory.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
  })

  it('edits existing recipe ingredients through recipesApi.update', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: {} } } })
    inventory.recipesApi.get.mockResolvedValue({
      data: {
        data: {
          portionYield: 2,
          prepTime: 5,
          cookTime: 3,
          notes: 'Servir caliente',
          lowStockThreshold: 6,
          lines: [{ rawMaterialId: 'rm1', rawMaterial: { name: 'Café molido' }, quantity: '0.04', unit: 'KILOGRAM', isOptional: false }],
        },
      },
    })
    mount({ mode: 'edit', productType: 'FOOD_AND_BEV' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findAllByText('Café molido', { selector: 'p' })
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.recipesApi.update).toHaveBeenCalledTimes(1))
    expect(http.put.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "/api/v1/dashboard/venues/v1/products/p1",
          {
            "categoryId": "c1",
            "description": "Tueste medio",
            "gtin": "7501234567893",
            "imageUrl": "https://cdn.example.com/cafe.jpg",
            "modifierGroupIds": [
              "m1",
            ],
            "name": "Café en grano",
            "price": 250,
            "printStationId": "station1",
            "sku": "CAFE-001",
            "soldByWeight": false,
          },
        ],
        [
          "/api/v1/dashboard/venues/v1/products/p1",
          {
            "inventoryMethod": "RECIPE",
            "trackInventory": true,
          },
        ],
      ]
    `)
    expect(inventory.recipesApi.update.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "v1",
          "p1",
          {
            "cookTime": 3,
            "ingredients": [
              {
                "isOptional": false,
                "quantity": 0.04,
                "rawMaterialId": "rm1",
                "unit": "KILOGRAM",
              },
            ],
            "lines": [
              {
                "isOptional": false,
                "quantity": 0.04,
                "rawMaterialId": "rm1",
                "unit": "KILOGRAM",
              },
            ],
            "notes": "Servir caliente",
            "portionYield": 2,
            "prepTime": 5,
          },
        ],
      ]
    `)
    expect(inventory.productWizardApi.configureRecipe).not.toHaveBeenCalled()
  })

  it('creates the existing family contract instead of a standalone product', async () => {
    mount()
    await fillProduct('Playera básica', '199')
    await openOptional('variants')
    await userEvent.click(screen.getByRole('checkbox', { name: /alta\.casilla/ }))
    change(screen.getByLabelText('opciones.nombre'), 'Talla')
    change(screen.getByLabelText('opciones.valores'), 'S, M,')
    change(screen.getByLabelText('tabla.precioTodas'), '199')
    await userEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(groups.createProductGroup).toHaveBeenCalledTimes(1))
    expect(groups.createProductGroup.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "v1",
          {
            "categoryId": "c1",
            "modifierGroupIds": [],
            "name": "Playera básica",
            "options": [
              {
                "name": "Talla",
                "values": [
                  "S",
                  "M",
                ],
              },
            ],
            "printStationId": null,
            "trackInventory": false,
            "type": "REGULAR",
            "variants": [
              {
                "price": 199,
                "values": [
                  "S",
                ],
              },
              {
                "price": 199,
                "values": [
                  "M",
                ],
              },
            ],
          },
        ],
      ]
    `)
    expect(inventory.productWizardApi.createProductWithInventory).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
  })

  it.each(['APPOINTMENTS_SERVICE', 'CLASS'] as const)('preserves %s fields and excludes inventory and modifiers', async productType => {
    mount({ productType })
    await fillProduct(productType === 'CLASS' ? 'Yoga' : 'Corte', '200')
    change(screen.getByLabelText(productType === 'CLASS' ? /Cupo máximo de participantes/ : /Duración \(minutos\)/), '60')
    expect(screen.queryByRole('switch', { name: 'wizard.step2.useInventory' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('wizard.step1.selectModifierGroups')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /alta\.casilla/ })).not.toBeInTheDocument()
    expect(await saveCreate()).toStrictEqual([
      [
        'v1',
        {
          product:
            productType === 'CLASS'
              ? {
                  name: 'Yoga',
                  description: '',
                  price: 200,
                  soldByWeight: false,
                  categoryId: 'c1',
                  maxParticipants: 60,
                  printStationId: null,
                  type: 'CLASS',
                }
              : {
                  name: 'Corte',
                  description: '',
                  price: 200,
                  soldByWeight: false,
                  categoryId: 'c1',
                  duration: 60,
                  printStationId: null,
                  type: 'APPOINTMENTS_SERVICE',
                },
          inventory: { useInventory: false },
        },
      ],
    ])
  })

  it.each(['DIGITAL', 'DONATION'] as const)('excludes category, inventory and modifiers for %s', async productType => {
    mount({ productType })
    await fillProduct(productType === 'DIGITAL' ? 'Guía digital' : 'Donativo', '100', false)
    expect(screen.queryByPlaceholderText('wizard.step1.categoryPlaceholder')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'wizard.step2.useInventory' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('wizard.step1.selectModifierGroups')).not.toBeInTheDocument()
    expect(await saveCreate()).toStrictEqual([
      [
        'v1',
        {
          product:
            productType === 'DIGITAL'
              ? { name: 'Guía digital', description: '', price: 100, soldByWeight: false, printStationId: null, type: 'DIGITAL' }
              : { name: 'Donativo', description: '', price: 100, soldByWeight: false, printStationId: null, type: 'DONATION' },
          inventory: { useInventory: false },
        },
      ],
    ])
  })
})

// Los PUT de la edición no eran mutaciones: «Guardar» seguía activo mientras iban en camino y un doble clic guardaba dos veces (D4).
describe('ProductWizardDialog: un solo guardado por clic', () => {
  const diferida = () => {
    let resolve!: (value: unknown) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise((si, no) => {
      resolve = si
      reject = no
    })
    return { promise, resolve, reject }
  }
  const conStock = (costPerUnit: number) => ({
    data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 7, minimumStock: 3, reservedStock: 0, costPerUnit } } },
  })
  const receta = {
    data: { data: { portionYield: 1, lines: [{ rawMaterialId: 'rm1', rawMaterial: { name: 'Café molido' }, quantity: '1', unit: 'KILOGRAM', isOptional: false }] } },
  }
  const stock = inventory.productWizardApi.configureSimpleStock
  const guardarBtn = () => screen.getByRole('button', { name: 'save' })
  const caminos = {
    'sin inventario': { preparar: () => undefined, listo: 'Café en grano', puts: 1, stock: 0, receta: 0 },
    'por cantidad con existencias tocadas': { preparar: () => inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock(20)), listo: '7', puts: 2, stock: 1, receta: 0 },
    'por cantidad con costo sin tocar el inventario': { preparar: () => inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock(20)), listo: '7', puts: 1, stock: 0, receta: 0 },
    'por cantidad sin costo ni tocar el inventario': { preparar: () => inventory.productWizardApi.getWizardProgress.mockResolvedValue(conStock(0)), listo: '7', puts: 1, stock: 0, receta: 0 },
    receta: {
      preparar: () => {
        inventory.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: {} } } })
        inventory.recipesApi.get.mockResolvedValue(receta)
      },
      listo: 'Café en grano',
      puts: 2,
      stock: 0,
      receta: 1,
    },
  }
  const abrirEdicion = async (camino: keyof typeof caminos) => {
    caminos[camino].preparar()
    mount({ mode: 'edit', productType: camino === 'receta' ? 'FOOD_AND_BEV' : 'REGULAR' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue(caminos[camino].listo)
    if (camino === 'receta') await screen.findAllByText('Café molido', { selector: 'p' })
    if (camino === 'por cantidad con existencias tocadas') change(screen.getByDisplayValue('7'), '8')
    await waitFor(() => expect(guardarBtn()).toBeEnabled())
  }
  const asentar = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })

  it.each(Object.keys(caminos) as Array<keyof typeof caminos>)('%s: el doble clic guarda una sola vez', async camino => {
    await abrirEdicion(camino)
    const put = diferida()
    http.put.mockReturnValueOnce(put.promise)
    await userEvent.dblClick(guardarBtn())
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(guardarBtn()).toBeDisabled()
    await act(async () => { put.resolve({ data: {} }); await put.promise })
    await asentar()
    expect({ puts: http.put.mock.calls.length, stock: stock.mock.calls.length, receta: inventory.recipesApi.update.mock.calls.length }).toStrictEqual({
      puts: caminos[camino].puts,
      stock: caminos[camino].stock,
      receta: caminos[camino].receta,
    })
  })

  it('dos clics del mismo instante también guardan una sola vez', async () => {
    await abrirEdicion('por cantidad sin costo ni tocar el inventario')
    const put = diferida()
    http.put.mockReturnValueOnce(put.promise)
    fireEvent.click(guardarBtn())
    fireEvent.click(guardarBtn())
    await waitFor(() => expect(http.put).toHaveBeenCalled())
    await asentar()
    expect(http.put).toHaveBeenCalledTimes(1)
    await act(async () => { put.resolve({ data: {} }); await put.promise })
  })

  it.each(Object.keys(caminos) as Array<keyof typeof caminos>)('%s: tras un error se libera y se puede reintentar', async camino => {
    await abrirEdicion(camino)
    const put = diferida()
    http.put.mockReturnValueOnce(put.promise)
    await userEvent.click(guardarBtn())
    await waitFor(() => expect(guardarBtn()).toBeDisabled())
    await act(async () => { put.reject({ response: { status: 500, data: { message: 'Falló' } } }); await put.promise.catch(() => undefined) })
    await waitFor(() => expect(guardarBtn()).toBeEnabled())
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Falló', variant: 'destructive' }))
    expect(stock).not.toHaveBeenCalled()
    expect(inventory.recipesApi.update).not.toHaveBeenCalled()
    await userEvent.click(guardarBtn())
    await asentar()
    expect(http.put).toHaveBeenCalledTimes(1 + caminos[camino].puts)
    expect(stock).toHaveBeenCalledTimes(caminos[camino].stock)
    expect(inventory.recipesApi.update).toHaveBeenCalledTimes(caminos[camino].receta)
  })
})
