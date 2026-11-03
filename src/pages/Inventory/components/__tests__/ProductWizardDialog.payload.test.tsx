/** Exact calls observed through the real form before the single-page visual change. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
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
    change(screen.getByLabelText('lowStockThreshold.label'), '2')
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
              "lowStockThreshold": 2,
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
    change(screen.getByLabelText('lowStockThreshold.labelPortions'), '6')
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
              "lowStockThreshold": 6,
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

  it('edits existing quantity stock through both product PUTs and the stock service', async () => {
    inventory.productWizardApi.getWizardProgress.mockResolvedValue({
      data: {
        data: {
          inventoryMethod: 'QUANTITY',
          details: { currentStock: 7, costPerUnit: 20, reorderPoint: 3 },
        },
      },
    })
    mount({ mode: 'edit' })
    await screen.findByDisplayValue('Café en grano')
    await screen.findByDisplayValue('7')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(inventory.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
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
            "inventoryMethod": "QUANTITY",
            "trackInventory": true,
          },
        ],
      ]
    `)
    expect(inventory.productWizardApi.configureSimpleStock.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "v1",
          "p1",
          {
            "costPerUnit": 20,
            "initialStock": 7,
            "lowStockThreshold": 10,
            "reorderPoint": 3,
            "unit": "UNIT",
          },
        ],
      ]
    `)
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
            "lowStockThreshold": 6,
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
