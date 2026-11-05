import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Radix Select usa pointer capture, que jsdom no trae. Funciones planas, NO vi.fn() (mockReset: true las vaciaría).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const svc = vi.hoisted(() => ({
  getMenuCategories: vi.fn(),
  getModifierGroups: vi.fn(),
  getIvaPorProducto: vi.fn(),
  // Función plana (no vi.fn): la clave de la consulta del estado del IVA.
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

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: http }))
const grupos = vi.hoisted(() => ({ createProductGroup: vi.fn(), listOptionLibrary: vi.fn() }))
vi.mock('@/services/productGroups.service', () => grupos)

const contexto = vi.hoisted(() => ({ venueId: 'v1' }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: contexto.venueId,
    venueSlug: 'mi-tienda',
    fullBasePath: '/venues/mi-tienda',
    venue: { id: contexto.venueId, organizationId: 'o1' },
  }),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
const plan = vi.hoisted(() => ({ hasAccess: false, isResolved: true }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => plan }))
vi.mock('@/firebase', () => ({ storage: {} }))
vi.mock('@/utils/cropImage', () => ({ getCroppedImg: async () => 'blob:foto-A' }))
vi.mock('firebase/storage', () => ({
  ref: () => ({}),
  getDownloadURL: async () => 'https://storage/foto-A.jpg',
  deleteObject: vi.fn(),
  uploadBytesResumable: () => ({
    snapshot: { ref: {} },
    on: (_event: string, _progress: unknown, _error: unknown, complete: () => void) => complete(),
  }),
}))
vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react')
  return {
    default: function CropperMock({ onCropComplete }: any) {
      useEffect(() => {
        onCropComplete(null, { x: 0, y: 0, width: 400, height: 400 })
      }, [onCropComplete])
      return null
    },
  }
})
vi.mock('@/hooks/use-print-stations', () => ({ usePrintStations: () => ({ data: [], isLoading: false }) }))
vi.mock('@/components/PrintStationField', () => ({ PrintStationField: () => null }))
vi.mock('@/features/master-catalog/use-master-catalog-error', () => ({ useMasterCatalogError: () => () => false }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es-MX' } }),
}))

import { ProductWizardDialog } from '../ProductWizardDialog'
import { CreateRecipeWizard } from '../CreateRecipeWizard'

import { deleteObject } from 'firebase/storage'

const diferida = () => {
  let resolve!: (value: any) => void
  let reject!: (reason: any) => void
  const promise = new Promise<any>((si, no) => {
    resolve = si
    reject = no
  })
  return { promise, resolve, reject }
}
const producto = (id: string) => ({
  id,
  name: `Producto ${id}`,
  description: '',
  price: 250,
  type: 'REGULAR',
  categoryId: 'c1',
  imageUrl: '',
  sku: id,
  gtin: '',
  modifierGroups: [],
  ivaTratamiento: 'IVA_16',
})
const bloqueoA = {
  response: {
    status: 409,
    data: {
      code: 'IVA_ENCENDIDO_BLOQUEADO',
      details: {
        bloqueos: [{ codigo: 'APARATO_VIEJO', mensaje: 'Bloqueo de A', comoArreglar: 'Actualizar A' }],
      },
    },
  },
}
function montar(mode: 'create' | 'edit' = 'edit') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  const onOpenChange = vi.fn()
  const onSuccess = vi.fn()
  const ui = (open: boolean, id: string, renderMode = mode, consumer = onSuccess) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProductWizardDialog
          open={open}
          onOpenChange={onOpenChange}
          onSuccess={consumer}
          mode={renderMode}
          productId={renderMode === 'edit' ? id : undefined}
          productType="REGULAR"
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const { rerender } = render(ui(true, 'a'))
  return { qc, onOpenChange, onSuccess, abrir: (open: boolean, id = 'a', renderMode = mode, consumer = onSuccess) => rerender(ui(open, id, renderMode, consumer)) }
}
const guardar = () => userEvent.click(screen.getByRole('button', { name: 'save' }))
async function escribirB() {
  const nombre = await screen.findByDisplayValue('Producto b')
  fireEvent.change(nombre, { target: { value: 'B sin perder' } })
}

beforeEach(() => {
  contexto.venueId = 'v1'
  plan.hasAccess = false
  grupos.listOptionLibrary.mockResolvedValue([])
  grupos.createProductGroup.mockResolvedValue({ groupId: 'familia-nueva', productIds: ['variante-s', 'variante-m'], categoryId: 'c1' })
  svc.getMenuCategories.mockResolvedValue([{ id: 'c1', name: 'Categoría' }])
  svc.getModifierGroups.mockResolvedValue([])
  svc.getIvaPorProducto.mockResolvedValue({ encendido: true, bloqueos: [], avisos: [], facturasSinSello: [] })
  inv.productWizardApi.shouldUseInventory.mockResolvedValue({ data: { data: {} } })
  inv.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: null, details: null } } })
  inv.productWizardApi.configureSimpleStock.mockResolvedValue({})
  inv.productWizardApi.createProductWithInventory.mockResolvedValue({ data: { data: { productId: 'nuevo' } } })
  inv.recipesApi.get.mockResolvedValue({ data: { data: null } })
  http.get.mockImplementation(async (url: string) => ({ data: { data: producto(url.endsWith('/b') ? 'b' : 'a') } }))
  http.put.mockResolvedValue({ data: {} })
  global.fetch = vi.fn(async () => ({ blob: async () => new Blob(['foto']) })) as any
})

afterEach(() => { onlineManager.setOnline(true) })

describe('asistente — respuestas y fotos entre aperturas', () => {
  async function llenarAlta(nombre = 'Producto nuevo') {
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: nombre } })
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Categoría' }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '35' } })
  }

  it('alta actual entrega al consumidor exactamente el ID devuelto antes de cerrar', async () => {
    inv.productWizardApi.createProductWithInventory.mockResolvedValueOnce({ data: { data: { productId: 'producto-devuelto' } } })
    const vista = montar('create')
    await llenarAlta()
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    expect(vista.onSuccess).toHaveBeenCalledExactlyOnceWith('producto-devuelto')
    expect(vista.onSuccess.mock.invocationCallOrder[0]).toBeLessThan(vista.onOpenChange.mock.invocationCallOrder[0])
  })

  it('alta A termina después de reabrir B: no notifica al consumidor ni borra B', async () => {
    const pendiente = diferida()
    inv.productWizardApi.createProductWithInventory.mockReturnValueOnce(pendiente.promise)
    const vista = montar('create')
    await llenarAlta('Alta A')
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(inv.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    const consumidorB = vi.fn()
    vista.abrir(true, 'b', 'create', consumidorB)
    await llenarAlta('Alta B')
    vista.onOpenChange.mockClear()
    await act(async () => { pendiente.resolve({ data: { data: { productId: 'producto-A' } } }); await pendiente.promise })
    expect(vista.onSuccess).not.toHaveBeenCalled()
    expect(consumidorB).not.toHaveBeenCalled()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Alta B')).toBeInTheDocument()
  })

  it('crear familia cierra sin entregar groupId como si fuera un productId', async () => {
    plan.hasAccess = true
    const vista = montar('create')
    await llenarAlta('Familia')
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-tour="product-wizard-add-variants"]')!)
    await userEvent.click(await screen.findByRole('checkbox', { name: /alta\.casilla/ }))
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S, M,' } })
    fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '35' } })
    fireEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    expect(grupos.createProductGroup).toHaveBeenCalledTimes(1)
    expect(inv.productWizardApi.createProductWithInventory).not.toHaveBeenCalled()
    expect(vista.onSuccess).not.toHaveBeenCalled()
  })

  function montarRecetas() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const onClose = vi.fn()
    const ui = (open: boolean) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CreateRecipeWizard open={open} onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const { rerender } = render(ui(true))
    return { invalidate, abrir: (open: boolean) => rerender(ui(open)), cambiarSucursal: (venueId: string) => { contexto.venueId = venueId; rerender(ui(true)) } }
  }

  async function crearDesdeRecetas() {
    await userEvent.click(await screen.findByPlaceholderText('recipeWizard.step1.searchPlaceholder'))
    await userEvent.click(await screen.findByRole('button', { name: 'recipeWizard.step1.createProduct' }))
    await llenarAlta('Producto de recetas')
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
  }

  it('Recetas real recibe el ID devuelto, selecciona el producto y refresca products-without-recipes', async () => {
    const nuevo = { ...producto('producto-receta'), name: 'Producto seleccionado', category: { id: 'c1', name: 'Categoría' } }
    http.get.mockImplementation(async (url: string) => ({ data: { data: url.endsWith('/producto-receta') ? nuevo : [] } }))
    inv.productWizardApi.createProductWithInventory.mockResolvedValueOnce({ data: { data: { productId: 'producto-receta' } } })
    const vista = montarRecetas()
    await crearDesdeRecetas()
    expect(await screen.findByText('Producto seleccionado')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/products/producto-receta', { params: { includeRecipe: true } })
    expect(screen.getByRole('button', { name: 'next' })).toBeEnabled()
    expect(vista.invalidate).toHaveBeenCalledWith({ queryKey: ['products-without-recipes', 'v1'] })
    await waitFor(() => expect(http.get.mock.calls.filter(([url]) => url === '/api/v1/dashboard/venues/v1/products').length).toBeGreaterThan(1))
  })

  it('Recetas reabierta no selecciona el producto del GET de la apertura anterior', async () => {
    const detalle = diferida()
    http.get.mockImplementation((url: string) => url.endsWith('/producto-receta') ? detalle.promise : Promise.resolve({ data: { data: [] } }))
    inv.productWizardApi.createProductWithInventory.mockResolvedValueOnce({ data: { data: { productId: 'producto-receta' } } })
    const vista = montarRecetas()
    await crearDesdeRecetas()
    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/products/producto-receta', { params: { includeRecipe: true } }))
    vista.abrir(false)
    vista.abrir(true)
    await act(async () => {
      detalle.resolve({ data: { data: { ...producto('producto-receta'), name: 'Producto de otra apertura', category: { id: 'c1', name: 'Categoría' } } } })
      await detalle.promise
    })
    expect(screen.queryByText('Producto de otra apertura')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
    expect(vista.invalidate).toHaveBeenCalledWith({ queryKey: ['products-without-recipes', 'v1'] })
  })

  function prepararDetallesPendientes() {
    const detalleA = diferida()
    const detalleB = diferida()
    const conCategoria = (id: string, name: string) => ({ ...producto(id), name, active: true, category: { id: 'c1', name: 'Categoría' } })
    const manualB = conCategoria('manual-B', 'Producto B')
    const altaA = conCategoria('alta-A', 'Alta A tardía')
    const altaB = conCategoria('alta-B', 'Alta B vigente')
    http.get.mockImplementation((url: string) => {
      if (url.endsWith('/alta-A')) return detalleA.promise
      if (url.endsWith('/alta-B')) return detalleB.promise
      return Promise.resolve({ data: { data: [manualB] } })
    })
    inv.productWizardApi.createProductWithInventory
      .mockResolvedValueOnce({ data: { data: { productId: 'alta-A' } } })
      .mockResolvedValueOnce({ data: { data: { productId: 'alta-B' } } })
    const resolver = async (detalle: ReturnType<typeof diferida>, producto: typeof altaA) => {
      await act(async () => { detalle.resolve({ data: { data: producto } }); await detalle.promise })
    }
    return { detalleA, detalleB, altaA, altaB, resolver }
  }

  async function seleccionarB() {
    await userEvent.click(await screen.findByPlaceholderText('recipeWizard.step1.searchPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: /Producto B/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'next' })).toBeEnabled())
  }

  async function altaConDetallePendiente(id = 'alta-A') {
    await crearDesdeRecetas()
    await waitFor(() => expect(http.get).toHaveBeenCalledWith(`/api/v1/dashboard/venues/v1/products/${id}`, { params: { includeRecipe: true } }))
    await waitFor(() => expect(screen.queryByPlaceholderText('wizard.step1.namePlaceholder')).not.toBeInTheDocument())
  }

  it('selección posterior B conserva el destino al avanzar a ingredientes y guardar aunque llegue detalle A', async () => {
    const carrera = prepararDetallesPendientes()
    inv.rawMaterialsApi.getAll.mockResolvedValue({ data: { data: [{ id: 'insumo-1', venueId: 'v1', name: 'Insumo de B', sku: 'INS-1',
      category: 'OTHER', currentStock: 10, unit: 'UNIT', minimumStock: 0, reorderPoint: 0, costPerUnit: 2,
      avgCostPerUnit: 2, perishable: false, notifyOnLowStock: false, active: true, createdAt: '2026-10-22', updatedAt: '2026-10-22' }] } })
    inv.recipesApi.create.mockResolvedValue({ data: {} })
    montarRecetas()
    await altaConDetallePendiente()
    await seleccionarB()
    await userEvent.click(screen.getByRole('button', { name: 'next' }))
    expect(await screen.findByRole('heading', { name: 'Producto B' })).toBeInTheDocument()
    await carrera.resolver(carrera.detalleA, carrera.altaA)
    expect(screen.getByRole('heading', { name: 'Producto B' })).toBeInTheDocument()
    await userEvent.click(screen.getByPlaceholderText('recipeWizard.step2.searchIngredientPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: /Insumo de B/ }))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '2' } })
    await userEvent.click(screen.getByRole('button', { name: 'recipeWizard.step2.addToRecipe' }))
    await userEvent.click(screen.getByRole('button', { name: 'next' }))
    await userEvent.click(screen.getByRole('button', { name: 'recipeWizard.createRecipe' }))
    await waitFor(() => expect(inv.recipesApi.create).toHaveBeenCalledExactlyOnceWith('v1', 'manual-B', expect.objectContaining({
      portionYield: 1, lines: [expect.objectContaining({ rawMaterialId: 'insumo-1', quantity: 2, unit: 'UNIT' })],
    })))
  })

  it('quitar B después de crear A conserva la selección vacía cuando llega detalle A', async () => {
    const carrera = prepararDetallesPendientes()
    montarRecetas()
    await seleccionarB()
    await altaConDetallePendiente()
    const tarjeta = screen.getByText('Producto B').parentElement!.parentElement!
    await userEvent.click(within(tarjeta).getByRole('button'))
    await carrera.resolver(carrera.detalleA, carrera.altaA)
    expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
  })

  it.each(['éxito', 'error'])('una búsqueda posterior conserva su texto y selección vacía al recibir %s del detalle A', async resultado => {
    const carrera = prepararDetallesPendientes()
    const vista = montarRecetas()
    await altaConDetallePendiente()
    fireEvent.change(screen.getByPlaceholderText('recipeWizard.step1.searchPlaceholder'), { target: { value: 'Otro producto' } })
    if (resultado === 'éxito') await carrera.resolver(carrera.detalleA, carrera.altaA)
    else await act(async () => { carrera.detalleA.reject(new Error('Detalle no disponible')); await carrera.detalleA.promise.catch(() => undefined) })
    expect(screen.getByPlaceholderText('recipeWizard.step1.searchPlaceholder')).toHaveValue('Otro producto')
    expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
    expect(vista.invalidate).toHaveBeenCalledWith({ queryKey: ['products-without-recipes', 'v1'] })
  })

  it('abrir y cancelar una segunda alta invalida el detalle pendiente de la primera', async () => {
    const carrera = prepararDetallesPendientes()
    montarRecetas()
    await altaConDetallePendiente()
    await userEvent.click(screen.getByPlaceholderText('recipeWizard.step1.searchPlaceholder'))
    await userEvent.click(await screen.findByRole('button', { name: 'recipeWizard.step1.createProduct' }))
    await userEvent.click(await screen.findByRole('button', { name: 'cancel' }))
    await carrera.resolver(carrera.detalleA, carrera.altaA)
    expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
  })

  it.each(['A primero', 'B primero'])('dos altas reales, detalles fuera de orden (%s): sólo la segunda puede seleccionar', async orden => {
    const carrera = prepararDetallesPendientes()
    montarRecetas()
    await altaConDetallePendiente()
    await altaConDetallePendiente('alta-B')
    if (orden === 'A primero') {
      await carrera.resolver(carrera.detalleA, carrera.altaA)
      expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
      await carrera.resolver(carrera.detalleB, carrera.altaB)
    } else {
      await carrera.resolver(carrera.detalleB, carrera.altaB)
      await carrera.resolver(carrera.detalleA, carrera.altaA)
    }
    expect(screen.getByText('Alta B vigente')).toBeInTheDocument()
    expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeEnabled()
  })

  it('cambiar sucursal no selecciona detalle viejo y sólo invalida el catálogo original', async () => {
    const carrera = prepararDetallesPendientes()
    const vista = montarRecetas()
    await altaConDetallePendiente()
    vista.cambiarSucursal('v2')
    vista.invalidate.mockClear()
    await carrera.resolver(carrera.detalleA, carrera.altaA)
    expect(screen.queryByText('Alta A tardía')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled()
    expect(vista.invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['products-without-recipes', 'v1'] })
  })

  it.each([false, true])('edición actual con inventario=%s conserva su callback con el ID editado', async inventario => {
    if (inventario)
      inv.productWizardApi.getWizardProgress.mockResolvedValue({
        data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
      })
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await guardar()
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    expect(vista.onSuccess).toHaveBeenCalledExactlyOnceWith('a')
  })

  it.each([
    [false, 'éxito'],
    [false, 'error'],
    [true, 'éxito'],
    [true, 'error'],
  ])('edición con inventario=%s: %s tardío de A no afecta B', async (inventario, resultado) => {
    if (inventario)
      inv.productWizardApi.getWizardProgress.mockResolvedValue({
        data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
      })
    const pendiente = diferida()
    http.put.mockReturnValueOnce(pendiente.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b')
    await escribirB()
    vista.onOpenChange.mockClear()
    toastMock.mockClear()
    await act(async () => {
      if (resultado === 'éxito') pendiente.resolve({ data: {} })
      else pendiente.reject(bloqueoA)
      await pendiente.promise.catch(() => undefined)
    })
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    expect(vista.onSuccess).not.toHaveBeenCalled()
    expect(screen.queryByText('Bloqueo de A')).not.toBeInTheDocument()
    // B no cambia, pero un guardado de A que falló con la ventana cerrada sí se avisa, con su nombre (D9).
    if (resultado === 'éxito') expect(toastMock).not.toHaveBeenCalled()
    else expect(toastMock.mock.calls).toEqual([[expect.objectContaining({ title: 'wizard.productNotSavedAfterClose', variant: 'destructive' })]])
    expect(inv.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
    expect(http.put).toHaveBeenCalledTimes(1)
  })

  it.each(['guardar', 'descartar'])('foto A confirmada → %s → abrir B sin foto no hereda la URL de A', async salida => {
    const vista = montar('create')
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Producto A' } })
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Categoría' }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '25' } })
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      if (this.type === 'file') {
        Object.defineProperty(this, 'files', { value: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] })
        this.dispatchEvent(new Event('change'))
      }
    })
    await userEvent.click(screen.getByText('wizard.step1.browseFile'))
    await userEvent.click(await screen.findByRole('button', { name: 'wizard.step1.confirm' }))
    expect(await screen.findByRole('img', { name: 'wizard.step1.imageUrl' })).toHaveAttribute('src', 'https://storage/foto-A.jpg')
    if (salida === 'guardar') {
      await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
      await waitFor(() => expect(inv.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
      expect(inv.productWizardApi.createProductWithInventory.mock.calls[0][1].product.imageUrl).toBe('https://storage/foto-A.jpg')
      await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    } else {
      await userEvent.click(screen.getByRole('button', { name: 'cancel' }))
    }
    vista.abrir(false)
    vista.abrir(true)
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Producto B' } })
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Categoría' }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '35' } })
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(inv.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(salida === 'guardar' ? 2 : 1))
    expect(inv.productWizardApi.createProductWithInventory.mock.calls[inv.productWizardApi.createProductWithInventory.mock.calls.length - 1]?.[1].product).not.toHaveProperty('imageUrl')
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it.each(['éxito', 'conflicto', 'error'])(
    'configuración ya enviada: %s tardío de A no cierra B ni abre su conversión',
    async resultado => {
      inv.productWizardApi.getWizardProgress.mockResolvedValue({
        data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
      })
      const pendiente = diferida()
      inv.productWizardApi.configureSimpleStock.mockReturnValueOnce(pendiente.promise)
      const vista = montar()
      await screen.findByDisplayValue('Producto a')
      fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
      await guardar()
      await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
      expect(inv.productWizardApi.configureSimpleStock.mock.calls[0].slice(0, 2)).toEqual(['v1', 'a'])
      vista.abrir(false)
      vista.abrir(true, 'b')
      await escribirB()
      vista.onOpenChange.mockClear()
      toastMock.mockClear()
      await act(async () => {
        if (resultado === 'éxito') pendiente.resolve({ data: {} })
        else pendiente.reject({ response: { status: resultado === 'conflicto' ? 409 : 500, data: { message: 'Error de A' } } })
        await pendiente.promise.catch(() => undefined)
      })
      expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
      expect(vista.onOpenChange).not.toHaveBeenCalled()
      expect(vista.onSuccess).not.toHaveBeenCalled()
      expect(screen.queryByText('conversion.toQuantity.title')).not.toBeInTheDocument()
      // El aviso lleva el nombre de A y no se mete con B: cerrar no debe dejar un fallo sin que nadie se entere (D9).
      if (resultado === 'éxito') expect(toastMock).not.toHaveBeenCalled()
      else expect(toastMock.mock.calls).toEqual([[expect.objectContaining({ title: 'wizard.inventoryNotSavedAfterClose', variant: 'destructive' })]])
      expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1)
    },
  )

  // D9: cerrar con la X durante el primer PUT no tira lo capturado; termina de enviarse, con lo de ESA apertura.
  it('cerrar durante el PUT: el inventario se manda igual, con lo capturado, y B no se entera', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const putA = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b')
    await escribirB()
    vista.onOpenChange.mockClear()
    toastMock.mockClear()
    await act(async () => { putA.resolve({ data: {} }); await putA.promise })
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(inv.productWizardApi.configureSimpleStock.mock.calls[0]).toEqual(['v1', 'a', expect.objectContaining({ initialStock: 33, reorderPoint: 3, costPerUnit: 2 })])
    expect(http.put.mock.calls[1]).toEqual(['/api/v1/dashboard/venues/v1/products/a', { trackInventory: true, inventoryMethod: 'QUANTITY' }])
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    expect(vista.onSuccess).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  // Codex r1: el envío tardío de A usa la misma mutación; al terminar antes que B dejaba `isPending` en falso con B todavía en camino.
  it('el envío tardío de A no vuelve a habilitar «Guardar» mientras B sigue guardando', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const putA = diferida()
    const stockB = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b')
    await screen.findByDisplayValue('Producto b')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '44' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    inv.productWizardApi.configureSimpleStock.mockReturnValueOnce(stockB.promise)
    await guardar()
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(inv.productWizardApi.configureSimpleStock.mock.calls[0].slice(0, 2)).toEqual(['v1', 'b'])
    await act(async () => { putA.resolve({ data: {} }); await putA.promise })
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(2))
    expect(inv.productWizardApi.configureSimpleStock.mock.calls[1][1]).toBe('a')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    await guardar().catch(() => undefined)
    expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(2)
    await act(async () => { stockB.resolve({}); await stockB.promise })
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
  })

  // Codex r2: lo que termina de enviarse al cerrar no gana contra un guardado más nuevo del MISMO producto.
  it('reabrir el mismo producto y guardar 44: el 33 de antes ya no se manda al terminar su PUT', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const putViejo = diferida()
    http.put.mockReturnValueOnce(putViejo.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'a')
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '44' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    await guardar()
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    await act(async () => { putViejo.resolve({ data: {} }); await putViejo.promise })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(inv.productWizardApi.configureSimpleStock.mock.calls.map(([, , stock]) => stock.initialStock)).toEqual([44])
  })

  // Codex r3: la comprobación del «último guardado» va justo antes de escribir, también si lo tardío ya venía en camino desde otra instancia.
  it('otra instancia guarda 44 con el PUT de activación de la vieja en camino: el 33 ya no se manda', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const putActivar = diferida()
    http.put.mockResolvedValueOnce({ data: {} }).mockReturnValueOnce(putActivar.promise)
    const lista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(2))
    lista.abrir(false)
    montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '44' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    await guardar()
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    await act(async () => { putActivar.resolve({ data: {} }); await putActivar.promise })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(inv.productWizardApi.configureSimpleStock.mock.calls.map(([, , stock]) => stock.initialStock)).toEqual([44])
  })

  // Codex r3: lo tardío de A no le apaga «Guardar» a B, un producto distinto que todavía no está guardando.
  it('el envío tardío de A no deshabilita «Guardar» de otro producto', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const putA = diferida()
    const stockA = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    inv.productWizardApi.configureSimpleStock.mockReturnValueOnce(stockA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b')
    await screen.findByDisplayValue('Producto b')
    await act(async () => { putA.resolve({ data: {} }); await putA.promise })
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    await act(async () => { stockA.resolve({}); await stockA.promise })
  })

  // Codex r4 #2: reabrir el MISMO producto mientras termina su guardado dejaba «Guardar» y «Cancelar» apagados sin explicación, y el
  // formulario con la lectura de antes. Ahora lo dice, espera, relee lo que quedó y se habilita solo.
  it('reabrir el mismo producto mientras termina su guardado: avisa, espera y se habilita con lo que quedó', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const stockA = diferida()
    inv.productWizardApi.configureSimpleStock.mockReturnValueOnce(stockA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '33' } })
    await guardar()
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'a')
    expect(await screen.findByText('wizard.savingPrevious')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'cancel' })).toBeEnabled() // cerrar no cruza escrituras
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 33, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    await act(async () => { stockA.resolve({}); await stockA.promise })
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    expect(screen.queryByText('wizard.savingPrevious')).not.toBeInTheDocument()
    expect(await screen.findByDisplayValue('33')).toBeInTheDocument() // lo que quedó, no la lectura de antes
    await guardar() // sin tocar nada: sólo el producto, sin reenviar existencias
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(3))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1)
  })

  it('cerrar durante el PUT de una receta: la receta se manda igual', async () => {
    plan.hasAccess = true
    inv.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: {} } } })
    inv.recipesApi.get.mockResolvedValue({
      data: { data: { portionYield: 1, lines: [{ rawMaterialId: 'rm1', rawMaterial: { name: 'Insumo' }, quantity: '1', unit: 'KILOGRAM', isOptional: false }] } },
    })
    inv.recipesApi.update.mockResolvedValue({})
    inv.rawMaterialsApi.getAll.mockResolvedValue({ data: { data: [] } })
    const putA = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await screen.findAllByText('Insumo', { selector: 'p' })
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    await act(async () => { putA.resolve({ data: {} }); await putA.promise })
    await waitFor(() => expect(inv.recipesApi.update).toHaveBeenCalledTimes(1))
    expect(inv.recipesApi.update.mock.calls[0][1]).toBe('a')
  })

  it('cerrar y que falle el primer PUT: también avisa, sin tocar B', async () => {
    const putA = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b')
    await escribirB()
    toastMock.mockClear()
    await act(async () => {
      putA.reject({ response: { status: 500, data: { message: 'Falló A' } } })
      await putA.promise.catch(() => undefined)
    })
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'wizard.productNotSavedAfterClose', description: 'Falló A', variant: 'destructive' })))
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
  })

  it.each(['éxito', 'error'])('conversión ya enviada: %s tardío de A no reintenta con B ni deja su diálogo abierto', async resultado => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    inv.productWizardApi.configureSimpleStock.mockRejectedValueOnce({
      response: { status: 409, data: {} },
      config: { data: JSON.stringify({ inventoryMethod: 'QUANTITY', simpleStock: { initialStock: 5, costPerUnit: 2, reorderPoint: 3 } }) },
    })
    const pendiente = diferida()
    inv.productInventoryApi.switchInventoryMethod.mockReturnValueOnce(pendiente.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    await userEvent.click(await screen.findByRole('button', { name: 'conversion.toQuantity.confirm' }))
    await waitFor(() => expect(inv.productInventoryApi.switchInventoryMethod).toHaveBeenCalledWith('v1', 'a', 'QUANTITY'))
    vista.abrir(false)
    vista.abrir(true, 'b')
    // El diálogo viejo puede tapar B en RED; escribir al campo identifica lo que debe sobrevivir.
    const nombreB = await screen.findByDisplayValue('Producto b')
    fireEvent.change(nombreB, { target: { value: 'B sin perder' } })
    vista.onOpenChange.mockClear()
    toastMock.mockClear()
    await act(async () => {
      if (resultado === 'éxito') pendiente.resolve({ data: {} })
      else pendiente.reject({ response: { status: 500, data: { message: 'Error de conversión A' } } })
      await pendiente.promise.catch(() => undefined)
    })
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    expect(vista.onSuccess).not.toHaveBeenCalled()
    expect(screen.queryByText('conversion.toQuantity.title')).not.toBeInTheDocument()
    expect(toastMock).not.toHaveBeenCalled()
    expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1)
    expect(http.put.mock.calls.every(([url]) => !String(url).includes('/products/b'))).toBe(true)
  })

  it('sin cerrar, la conversión reintenta la configuración de A con su captura original', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const stock = { initialStock: 5, costPerUnit: 2, reorderPoint: 3 }
    inv.productWizardApi.configureSimpleStock.mockRejectedValueOnce({
      response: { status: 409, data: {} },
      config: { data: JSON.stringify({ inventoryMethod: 'QUANTITY', simpleStock: stock }) },
    })
    inv.productInventoryApi.switchInventoryMethod.mockResolvedValue({})
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    await userEvent.click(await screen.findByRole('button', { name: 'conversion.toQuantity.confirm' }))
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(2))
    expect(inv.productWizardApi.configureSimpleStock.mock.calls[1]).toEqual(['v1', 'a', stock])
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
  })

  it('configuración pausada antes del primer servicio conserva el destino A al reanudar después de abrir B', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    http.put.mockImplementationOnce(async () => { onlineManager.setOnline(false); return { data: {} } })
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    await waitFor(() => expect(vista.qc.getMutationCache().getAll().some(m => m.state.isPaused)).toBe(true))
    expect(http.put).toHaveBeenCalledTimes(1)
    expect(inv.productWizardApi.configureSimpleStock).not.toHaveBeenCalled()
    vista.abrir(false)
    vista.abrir(true, 'b')
    await escribirB()
    vista.onOpenChange.mockClear()
    await act(async () => { onlineManager.setOnline(true); await vista.qc.resumePausedMutations() })
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    expect(inv.productWizardApi.configureSimpleStock.mock.calls[0]).toEqual([
      'v1', 'a', expect.objectContaining({ initialStock: 6, costPerUnit: 2, reorderPoint: 3 }),
    ])
    expect(http.put.mock.calls[1]).toEqual(['/api/v1/dashboard/venues/v1/products/a', { trackInventory: true, inventoryMethod: 'QUANTITY' }])
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
  })

  it('conversión pausada antes del servicio conserva producto y dirección A al reanudar después de abrir B', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    inv.productWizardApi.configureSimpleStock.mockRejectedValueOnce({
      response: { status: 409, data: {} },
      config: { data: JSON.stringify({ inventoryMethod: 'QUANTITY', simpleStock: { initialStock: 5, costPerUnit: 2, reorderPoint: 3 } }) },
    })
    inv.productInventoryApi.switchInventoryMethod.mockResolvedValue({})
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    const confirmar = await screen.findByRole('button', { name: 'conversion.toQuantity.confirm' })
    act(() => onlineManager.setOnline(false))
    await userEvent.click(confirmar)
    await waitFor(() => expect(vista.qc.getMutationCache().getAll().some(m => m.state.isPaused)).toBe(true))
    expect(inv.productInventoryApi.switchInventoryMethod).not.toHaveBeenCalled()
    vista.abrir(false)
    vista.abrir(true, 'b')
    await escribirB()
    vista.onOpenChange.mockClear()
    toastMock.mockClear()
    await act(async () => { onlineManager.setOnline(true); await vista.qc.resumePausedMutations() })
    expect(inv.productInventoryApi.switchInventoryMethod).toHaveBeenCalledExactlyOnceWith('v1', 'a', 'QUANTITY')
    expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1)
    expect(screen.getByDisplayValue('B sin perder')).toBeInTheDocument()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('el éxito de configuración de edición A no muestra toast en una nueva alta B', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const pendiente = diferida()
    inv.productWizardApi.configureSimpleStock.mockReturnValueOnce(pendiente.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    await waitFor(() => expect(inv.productWizardApi.configureSimpleStock).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b', 'create')
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Nueva alta B' } })
    toastMock.mockClear()
    vista.onOpenChange.mockClear()
    await act(async () => { pendiente.resolve({}); await pendiente.promise })
    expect(screen.getByDisplayValue('Nueva alta B')).toBeInTheDocument()
    expect(toastMock).not.toHaveBeenCalled()
    expect(vista.onOpenChange).not.toHaveBeenCalled()
  })

  // Estas lecturas llenan el formulario una sola vez al abrir: con la copia de antes del guardado, volver a guardar sin tocar nada
  // devolvía el mínimo, las existencias y el precio a como estaban.
  it('reabrir sin recargar muestra lo recién guardado por cantidad, no la copia de antes', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await screen.findByDisplayValue('5')
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 9, minimumStock: 7, reservedStock: 0, costPerUnit: 2 } } },
    })
    http.get.mockImplementation(async () => ({ data: { data: { ...producto('a'), name: 'Nombre nuevo' } } }))
    await guardar()
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    vista.abrir(false)
    vista.abrir(true, 'a')
    await screen.findByDisplayValue('Nombre nuevo')
    await screen.findByDisplayValue('9')
    expect(screen.getByLabelText(/^wizard\.step3\.reorderPoint/)).toHaveValue(7)
  })

  it('reabrir sin recargar muestra la receta recién guardada, no la copia de antes', async () => {
    const receta = (nombre: string, id: string) => ({
      data: { data: { portionYield: 1, lines: [{ rawMaterialId: id, rawMaterial: { name: nombre }, quantity: '1', unit: 'KILOGRAM', isOptional: false }] } },
    })
    plan.hasAccess = true
    inv.productWizardApi.getWizardProgress.mockResolvedValue({ data: { data: { inventoryMethod: 'RECIPE', details: {} } } })
    inv.recipesApi.get.mockResolvedValue(receta('Insumo viejo', 'rm1'))
    inv.recipesApi.update.mockResolvedValue({})
    inv.rawMaterialsApi.getAll.mockResolvedValue({ data: { data: [] } })
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await screen.findAllByText('Insumo viejo', { selector: 'p' })
    inv.recipesApi.get.mockResolvedValue(receta('Insumo nuevo', 'rm2'))
    await guardar()
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    vista.abrir(false)
    vista.abrir(true, 'a')
    await screen.findAllByText('Insumo nuevo', { selector: 'p' })
    expect(screen.queryByText('Insumo viejo')).not.toBeInTheDocument()
  })

  // El PUT de la edición de A no es una mutación: su candado es de ESA apertura. Ni le estorba a B ni A se lo quita al terminar.
  it('PUT de edición A en camino: B guarda libre, y cuando A termina no suelta el candado de B', async () => {
    const putA = diferida()
    const putB = diferida()
    http.put.mockReturnValueOnce(putA.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    vista.abrir(false)
    vista.abrir(true, 'b')
    await screen.findByDisplayValue('Producto b')
    await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
    http.put.mockReturnValueOnce(putB.promise)
    await guardar()
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(2))
    await act(async () => { putA.resolve({ data: {} }); await putA.promise })
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    await guardar().catch(() => undefined)
    expect(http.put).toHaveBeenCalledTimes(2)
    await act(async () => { putB.resolve({ data: {} }); await putB.promise })
    await waitFor(() => expect(vista.onOpenChange).toHaveBeenCalledWith(false))
  })

  it('B está guardando cuando A termina: onSettled de A no libera el candado de cierre de B', async () => {
    inv.productWizardApi.getWizardProgress.mockResolvedValue({
      data: { data: { inventoryMethod: 'QUANTITY', details: { currentStock: 5, minimumStock: 3, reservedStock: 0, costPerUnit: 2 } } },
    })
    inv.productWizardApi.configureSimpleStock.mockRejectedValueOnce({
      response: { status: 409, data: {} },
      config: { data: JSON.stringify({ inventoryMethod: 'QUANTITY', simpleStock: { initialStock: 5, costPerUnit: 2, reorderPoint: 3 } }) },
    })
    const conversionA = diferida()
    inv.productInventoryApi.switchInventoryMethod.mockReturnValueOnce(conversionA.promise)
    const guardadoB = diferida()
    inv.productWizardApi.createProductWithInventory.mockReturnValueOnce(guardadoB.promise)
    const vista = montar()
    await screen.findByDisplayValue('Producto a')
    fireEvent.change(await screen.findByDisplayValue('5'), { target: { value: '6' } })
    await guardar()
    await userEvent.click(await screen.findByRole('button', { name: 'conversion.toQuantity.confirm' }))
    await waitFor(() => expect(inv.productInventoryApi.switchInventoryMethod).toHaveBeenCalledTimes(1))
    vista.abrir(false)
    vista.abrir(true, 'b', 'create')
    fireEvent.change(await screen.findByPlaceholderText('wizard.step1.namePlaceholder'), { target: { value: 'Alta B guardando' } })
    await userEvent.click(screen.getByPlaceholderText('wizard.step1.categoryPlaceholder'))
    await userEvent.click(await screen.findByRole('option', { name: 'Categoría' }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '35' } })
    await userEvent.click(screen.getByRole('button', { name: 'wizard.finish' }))
    await waitFor(() => expect(inv.productWizardApi.createProductWithInventory).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'wizard.finish' })).toBeDisabled()
    vista.onOpenChange.mockClear()
    await act(async () => { conversionA.resolve({}); await conversionA.promise })
    expect(vista.onOpenChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^(Cerrar|common:close)$/ }))
    expect(vista.onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByText('wizard.discard.title')).not.toBeInTheDocument()
    await act(async () => { guardadoB.resolve({ data: { data: { productId: 'nuevo-B' } } }); await guardadoB.promise })
  })

})
